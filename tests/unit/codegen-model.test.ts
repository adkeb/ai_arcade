import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import test from "node:test";
import { runCodeGenAgent } from "@ai-arcade/agent/agents/code-gen";
import type { GameDesignSpec, IntentPlan } from "@ai-arcade/agent/types";

type RecordedRequest = {
  authorization: string | undefined;
  body: Record<string, unknown>;
};

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function remoteGameJson(marker: string) {
  const gameJs = `
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const timeEl = document.getElementById("time");
  const overlay = document.getElementById("overlay");
  const statusEl = document.getElementById("status");
  const startButton = document.getElementById("start");
  const restartButton = document.getElementById("restart");
  window.__remoteCodegenMarker = "${marker}";
  const state = {
    running: false,
    score: 0,
    lives: 3,
    time: 36,
    last: 0,
    width: 960,
    height: 540,
    keys: new Set(),
    player: { x: 140, y: 270, radius: 18, speed: 330 },
    sparks: [],
    hazards: [],
    wave: 0
  };
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.max(1, Math.floor((rect.width || 960) / 960));
    canvas.width = 960 * scale;
    canvas.height = 540 * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }
  function reset() {
    state.running = false;
    state.score = 0;
    state.lives = 3;
    state.time = 36;
    state.wave = 0;
    state.player.x = 140;
    state.player.y = 270;
    state.sparks = Array.from({ length: 7 }, (_, index) => ({ x: 280 + index * 82, y: 90 + (index % 4) * 92, radius: 11, value: 25 }));
    state.hazards = Array.from({ length: 5 }, (_, index) => ({ x: 460 + index * 105, y: 70 + (index % 3) * 140, radius: 20, speed: 82 + index * 12 }));
    updateHud();
    render();
  }
  function updateHud() {
    scoreEl.textContent = String(state.score);
    livesEl.textContent = String(state.lives);
    timeEl.textContent = String(Math.max(0, Math.ceil(state.time)));
  }
  function startGame() {
    reset();
    state.running = true;
    overlay.hidden = true;
    state.last = performance.now();
    requestAnimationFrame(loop);
  }
  function endGame(message) {
    state.running = false;
    overlay.hidden = false;
    startButton.hidden = true;
    restartButton.hidden = false;
    statusEl.textContent = message + " Score " + state.score + ". Restart to chase a better route.";
  }
  function movePlayer(dt) {
    const dx = (state.keys.has("ArrowRight") || state.keys.has("KeyD") ? 1 : 0) - (state.keys.has("ArrowLeft") || state.keys.has("KeyA") ? 1 : 0);
    const dy = (state.keys.has("ArrowDown") || state.keys.has("KeyS") ? 1 : 0) - (state.keys.has("ArrowUp") || state.keys.has("KeyW") ? 1 : 0);
    const length = Math.hypot(dx, dy) || 1;
    state.player.x = Math.min(930, Math.max(30, state.player.x + (dx / length) * state.player.speed * dt));
    state.player.y = Math.min(510, Math.max(30, state.player.y + (dy / length) * state.player.speed * dt));
  }
  function collide(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y) < a.radius + b.radius;
  }
  function update(dt) {
    state.time -= dt;
    state.wave += dt;
    movePlayer(dt);
    for (const hazard of state.hazards) {
      hazard.x -= hazard.speed * dt;
      hazard.y += Math.sin(state.wave * 2 + hazard.radius) * 42 * dt;
      if (hazard.x < -30) hazard.x = 990;
      if (collide(state.player, hazard)) {
        hazard.x = 990;
        state.lives -= 1;
        state.score = Math.max(0, state.score - 15);
      }
    }
    for (const spark of state.sparks) {
      if (spark.value > 0 && collide(state.player, spark)) {
        spark.value = 0;
        state.score += 25;
      }
    }
    if (state.sparks.every((spark) => spark.value === 0)) {
      state.score += Math.ceil(state.time) * 3;
      endGame("Victory: every circuit bloom was collected.");
    }
    if (state.lives <= 0) endGame("Defeat: the hazard field overwhelmed the pilot.");
    if (state.time <= 0) endGame(state.score >= 100 ? "Win: the timer expired with enough points." : "Lose: collect more points before time runs out.");
    updateHud();
  }
  function render() {
    ctx.clearRect(0, 0, 960, 540);
    ctx.fillStyle = "#101820";
    ctx.fillRect(0, 0, 960, 540);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    for (let x = 40; x < 960; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + Math.sin(state.wave + x) * 10, 540);
      ctx.stroke();
    }
    ctx.fillStyle = "#00c2a8";
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffbe0b";
    for (const spark of state.sparks) {
      if (spark.value > 0) {
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#ef476f";
    for (const hazard of state.hazards) {
      ctx.beginPath();
      ctx.rect(hazard.x - 18, hazard.y - 18, 36, 36);
      ctx.fill();
    }
  }
  function loop(now) {
    if (!state.running) return;
    const dt = Math.min(0.05, (now - state.last) / 1000);
    state.last = now;
    update(dt);
    render();
    if (state.running) requestAnimationFrame(loop);
  }
  addEventListener("keydown", (event) => state.keys.add(event.code));
  addEventListener("keyup", (event) => state.keys.delete(event.code));
  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    state.player.x = ((event.clientX - rect.left) / rect.width) * 960;
    state.player.y = ((event.clientY - rect.top) / rect.height) * 540;
  });
  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", startGame);
  addEventListener("resize", resize);
  resize();
  reset();
})();
`;
  const styleCss = `
:root{color-scheme:dark;--bg:#101820;--primary:#00c2a8;--accent:#ffbe0b;--danger:#ef476f}
*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:#f8fafc;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
.shell{min-height:100vh;display:grid;grid-template-rows:auto 1fr;gap:14px;padding:18px}
.hud{display:flex;justify-content:space-between;align-items:center;gap:18px}.hud h1{margin:0;font-size:clamp(22px,4vw,38px);letter-spacing:0}
.stats{display:flex;gap:8px;flex-wrap:wrap}.stats span{border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);border-radius:8px;padding:8px 10px;min-width:82px}
.stage{position:relative;min-height:0;border:1px solid rgba(255,255,255,.18);border-radius:8px;overflow:hidden;background:#0b1118}
canvas{width:100%;height:100%;display:block;aspect-ratio:16/9}.overlay{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:12px;padding:28px;background:rgba(7,12,18,.78)}
.overlay[hidden]{display:none}.overlay h2{margin:0;font-size:clamp(24px,5vw,44px)}.overlay p{max-width:620px;margin:0 auto;line-height:1.6;color:#dbeafe}
button{justify-self:center;border:0;border-radius:8px;background:var(--primary);color:#041014;font-weight:900;padding:11px 18px;cursor:pointer}.status{font-weight:700}
@media (max-width:720px){.hud{align-items:flex-start;flex-direction:column}.shell{padding:10px}.stats span{min-width:74px;padding:7px 8px}}
`;
  return JSON.stringify({
    indexHtml:
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'self\'; style-src \'self\'; connect-src \'none\'; base-uri \'none\'; form-action \'none\'; object-src \'none\'"><title>Mock Model Runner</title><link rel="stylesheet" href="./style.css"></head><body><main class="shell"><section class="hud"><h1>Mock Model Runner</h1><div class="stats"><span>Score <strong id="score">0</strong></span><span>Lives <strong id="lives">3</strong></span><span>Time <strong id="time">36</strong></span></div></section><section class="stage"><canvas id="game" width="960" height="540"></canvas><div id="overlay" class="overlay"><h2>Mock Model Runner</h2><p>Collect circuit blooms, dodge hazards, and win before the timer ends.</p><button id="start" type="button">Start</button><button id="restart" type="button" hidden>Restart</button><p id="status" class="status">Use arrows, WASD, or pointer controls.</p></div></section></main><script src="./game.js" defer></script></body></html>',
    gameJs,
    styleCss,
  });
}

async function withMockChatServer<T>(
  responses: string[],
  handler: (requests: RecordedRequest[]) => Promise<T>,
): Promise<T> {
  const requests: RecordedRequest[] = [];
  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/chat/completions") {
      response.writeHead(404).end();
      return;
    }

    requests.push({
      authorization: request.headers.authorization,
      body: await readJson(request),
    });
    response.setHeader("content-type", "application/json");
    const content =
      responses[Math.min(requests.length - 1, responses.length - 1)] ??
      remoteGameJson("mock-llm");
    response.end(JSON.stringify({ choices: [{ message: { content } }] }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");

  const previous = {
    fallback: process.env.USE_LOCAL_AGENT_FALLBACK,
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: process.env.OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL,
    thinking: process.env.OPENAI_ENABLE_THINKING,
  };

  process.env.USE_LOCAL_AGENT_FALLBACK = "false";
  process.env.OPENAI_API_KEY = "test-model-key";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.OPENAI_MODEL = "mock-json-model";
  process.env.OPENAI_ENABLE_THINKING = "false";

  try {
    return await handler(requests);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    restoreEnv("USE_LOCAL_AGENT_FALLBACK", previous.fallback);
    restoreEnv("OPENAI_API_KEY", previous.apiKey);
    restoreEnv("OPENAI_BASE_URL", previous.baseUrl);
    restoreEnv("OPENAI_MODEL", previous.model);
    restoreEnv("OPENAI_ENABLE_THINKING", previous.thinking);
  }
}

const design: GameDesignSpec = {
  title: "Mock Model Runner",
  description: "A generated arcade game from a mocked model response.",
  tags: ["mock", "codegen"],
  coverPrompt: "mock model arcade cover",
  gameplayLoop: "Move, collect, avoid, and score before the timer ends.",
  controls: ["Arrow keys", "WASD"],
  scoring: "Collect crystals and preserve lives.",
  difficulty: "medium",
  runtimeRequirements: ["HTML5 Canvas", "iframe sandbox"],
  theme: {
    background: "#101820",
    primary: "#00c2a8",
    accent: "#ffbe0b",
    danger: "#ef476f",
  },
  durationSeconds: 30,
};

const intent: IntentPlan = {
  genre: "arcade",
  coreMechanics: ["move", "collect", "avoid"],
  artStyle: "neon vector",
  playerGoal: "score high",
  winCondition: "survive the round",
  loseCondition: "lose all lives",
  controls: ["Arrow keys"],
  entities: ["player", "crystals", "hazards"],
  mood: "fast and readable",
  seed: 1234,
};

test("CodeGenAgent uses an OpenAI-compatible model response when configured", async () => {
  await withMockChatServer([remoteGameJson("mock-llm")], async (requests) => {
    const files = await runCodeGenAgent({ design, intent });

    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.authorization, "Bearer test-model-key");
    assert.equal(requests[0]?.body.model, "mock-json-model");
    assert.equal(requests[0]?.body.enable_thinking, false);
    assert.equal(files.gameJs.includes("mock-llm"), true);
    assert.equal(files.indexHtml.includes("Content-Security-Policy"), true);
    assert.equal(files.styleCss.includes("canvas"), true);
    assert.equal(files.source, "remote-model");
    assert.equal(files.repairAttempts, 0);
  });
});

test("CodeGenAgent repairs noncompliant model output and keeps the repaired source", async () => {
  const broken = JSON.stringify({
    indexHtml: '<html><body><canvas id="game"></canvas></body></html>',
    gameJs: "requestAnimationFrame(() => {});",
    styleCss: "canvas{display:block}",
  });

  await withMockChatServer(
    [broken, remoteGameJson("repair-llm")],
    async (requests) => {
      const files = await runCodeGenAgent({ design, intent });

      assert.equal(requests.length, 2);
      assert.equal(files.source, "remote-repair-1");
      assert.equal(files.repairAttempts, 1);
      assert.equal(files.gameJs.includes("repair-llm"), true);

      const secondBody = JSON.stringify(requests[1]?.body);
      assert.match(secondBody, /previousAttemptFailed/);
      assert.match(secondBody, /Content-Security-Policy|CSP|too short/);
    },
  );
});

test("CodeGenAgent fails clearly when no model key is configured and local fallback is disabled", async () => {
  const previous = {
    fallback: process.env.USE_LOCAL_AGENT_FALLBACK,
    openAiKey: process.env.OPENAI_API_KEY,
    dashscopeKey: process.env.DASHSCOPE_API_KEY,
  };

  process.env.USE_LOCAL_AGENT_FALLBACK = "false";
  delete process.env.OPENAI_API_KEY;
  delete process.env.DASHSCOPE_API_KEY;

  try {
    await assert.rejects(
      () => runCodeGenAgent({ design, intent }),
      /未配置真实模型，不能执行 AI 原创生成/,
    );
  } finally {
    restoreEnv("USE_LOCAL_AGENT_FALLBACK", previous.fallback);
    restoreEnv("OPENAI_API_KEY", previous.openAiKey);
    restoreEnv("DASHSCOPE_API_KEY", previous.dashscopeKey);
  }
});
