import type { AssetSummary, GameDesignSpec, GameSourceFiles, IntentPlan } from "./types";

function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hasAny(prompt: string, words: string[]): boolean {
  const lowered = prompt.toLowerCase();
  return words.some((word) => lowered.includes(word.toLowerCase()));
}

function pick<T>(items: T[], seed: number): T {
  return items[seed % items.length] as T;
}

export function planIntentFromPrompt(prompt: string, assets: AssetSummary[]): IntentPlan {
  const seed = hashText(`${prompt}:${assets.map((asset) => asset.originalName).join("|")}`);
  const isSpace = hasAny(prompt, ["space", "ship", "asteroid", "太空", "飞船", "陨石", "能量"]);
  const isCyber = hasAny(prompt, ["cyber", "neon", "赛博", "霓虹"]);
  const isGarden = hasAny(prompt, ["garden", "flower", "memory", "花园", "记忆"]);
  const isRunner = hasAny(prompt, ["runner", "run", "跑酷", "奔跑"]);
  const isPuzzle = hasAny(prompt, ["puzzle", "match", "解谜", "配对"]);

  const genre = isPuzzle ? "memory puzzle" : isRunner ? "arcade runner" : "avoid-and-collect arcade";
  const artStyle = isCyber
    ? "neon cyberpunk"
    : isGarden
      ? "soft botanical pixel art"
      : isSpace
        ? "pixel space opera"
        : pick(["crisp arcade pixel art", "paper-cut toy world", "retro synth arcade"], seed);

  const entities = isGarden
    ? ["player sprite", "memory blooms", "shadow thorns"]
    : isSpace
      ? ["pilot ship", "asteroids", "energy cores"]
      : ["player avatar", "hazards", "score orbs"];

  return {
    genre,
    coreMechanics: [
      "move within a bounded canvas",
      "avoid fast hazards",
      "collect score items",
      assets.length > 0 ? "reference uploaded material as visual inspiration" : "procedurally vary colors from prompt"
    ],
    artStyle,
    playerGoal: "survive the full timer while collecting as many rewards as possible",
    winCondition: "timer reaches zero with at least one life remaining",
    loseCondition: "all lives are lost before the timer ends",
    controls: ["Arrow keys", "WASD", "mouse or touch drag"],
    entities,
    mood: isCyber ? "electric and tense" : isGarden ? "calm but tricky" : "fast and playful",
    seed
  };
}

export function designGameFromIntent(prompt: string, intent: IntentPlan): GameDesignSpec {
  const titlePool =
    intent.artStyle.includes("space")
      ? ["Asteroid Energy Run", "Orbit Spark Dash", "Cosmic Core Drift"]
      : intent.artStyle.includes("botanical")
        ? ["Memory Garden", "Bloom Signal", "Petal Path"]
        : intent.artStyle.includes("cyber")
          ? ["Neon Drift", "Circuit Rush", "Chrome Pulse"]
          : ["Pixel Runner", "Arcade Spark", "Signal Sprint"];

  const title = pick(titlePool, intent.seed);
  const difficulty = intent.seed % 5 === 0 ? "hard" : intent.seed % 2 === 0 ? "medium" : "easy";
  const durationSeconds = hasAny(prompt, ["30", "三十", "half minute"]) ? 30 : difficulty === "hard" ? 45 : 35;
  const palette = intent.artStyle.includes("cyber")
    ? { background: "#17151f", primary: "#18d6c5", accent: "#ffd166", danger: "#ff5c8a" }
    : intent.artStyle.includes("botanical")
      ? { background: "#18231f", primary: "#9be564", accent: "#f6d365", danger: "#f25f5c" }
      : intent.artStyle.includes("space")
        ? { background: "#101827", primary: "#7dd3fc", accent: "#facc15", danger: "#fb7185" }
        : { background: "#16181d", primary: "#70e000", accent: "#fbbf24", danger: "#f97316" };

  const tags = Array.from(
    new Set([
      intent.genre.split(" ")[0] ?? "arcade",
      intent.artStyle.includes("cyber") ? "cyberpunk" : intent.artStyle.includes("space") ? "space" : "pixel",
      difficulty,
      "agent-generated"
    ])
  );

  return {
    title,
    description: `${title} is a ${intent.mood} ${intent.genre} game generated from: ${prompt.slice(0, 140)}${
      prompt.length > 140 ? "..." : ""
    }`,
    tags,
    coverPrompt: `${intent.artStyle} cover for ${title}, ${intent.entities.join(", ")}`,
    gameplayLoop:
      "Start the round, move the player through incoming hazards, collect glowing rewards, and finish with a score summary.",
    controls: intent.controls,
    scoring: "Rewards add points, survival time adds a bonus, collisions remove lives.",
    difficulty,
    runtimeRequirements: ["HTML5 Canvas", "keyboard input", "pointer input", "postMessage telemetry"],
    theme: palette,
    durationSeconds
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[char] ?? char;
  });
}

export function generateCoverSvg(design: GameDesignSpec): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-label="${escapeHtml(
    design.title
  )}">
  <rect width="960" height="540" fill="${design.theme.background}"/>
  <g opacity="0.92">
    <circle cx="170" cy="122" r="72" fill="${design.theme.primary}"/>
    <rect x="618" y="82" width="168" height="168" rx="24" fill="${design.theme.danger}"/>
    <path d="M132 388 C 270 270, 408 482, 546 330 S 792 254, 854 368" fill="none" stroke="${design.theme.accent}" stroke-width="26" stroke-linecap="round"/>
    <polygon points="470,170 538,292 402,292" fill="${design.theme.primary}"/>
  </g>
  <rect x="56" y="344" width="848" height="124" rx="18" fill="rgba(0,0,0,0.42)"/>
  <text x="84" y="398" fill="#fff" font-family="Arial, sans-serif" font-size="54" font-weight="700">${escapeHtml(
    design.title
  )}</text>
  <text x="86" y="438" fill="#f8fafc" font-family="Arial, sans-serif" font-size="24">${escapeHtml(
    design.tags.slice(0, 3).join(" / ")
  )}</text>
</svg>`;
}

export function generateGameFiles(design: GameDesignSpec, intent: IntentPlan): GameSourceFiles {
  const config = {
    title: design.title,
    description: design.description,
    duration: design.durationSeconds,
    difficulty: design.difficulty,
    theme: design.theme,
    labels: {
      player: intent.entities[0] ?? "player",
      hazard: intent.entities[1] ?? "hazard",
      pickup: intent.entities[2] ?? "reward"
    },
    seed: intent.seed,
    speedMultiplier: design.difficulty === "hard" ? 1.3 : design.difficulty === "medium" ? 1.1 : 0.92
  };

  const indexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src data: blob:; connect-src 'none'; base-uri 'none'; object-src 'none';" />
    <title>${escapeHtml(design.title)}</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <main class="shell">
      <section class="hud">
        <div>
          <p class="eyebrow">AI Arcade</p>
          <h1>${escapeHtml(design.title)}</h1>
        </div>
        <div class="stats">
          <span>Score <strong id="score">0</strong></span>
          <span>Lives <strong id="lives">3</strong></span>
          <span>Time <strong id="time">${design.durationSeconds}</strong></span>
        </div>
      </section>
      <div class="stage">
        <canvas id="game" width="960" height="540" aria-label="${escapeHtml(design.title)} canvas game"></canvas>
        <div id="overlay" class="overlay">
          <h2>${escapeHtml(design.title)}</h2>
          <p>${escapeHtml(design.gameplayLoop)}</p>
          <button id="start" type="button">Start</button>
          <button id="restart" type="button" hidden>Restart</button>
          <p id="status" class="status">Use Arrow keys, WASD, mouse, or touch.</p>
        </div>
      </div>
    </main>
    <script src="./game.js" defer></script>
  </body>
</html>`;

  const styleCss = `:root {
  color-scheme: dark;
  --bg: ${design.theme.background};
  --primary: ${design.theme.primary};
  --accent: ${design.theme.accent};
  --danger: ${design.theme.danger};
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  min-height: 100%;
  overflow: hidden;
  background: var(--bg);
  color: #f8fafc;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.shell {
  width: 100vw;
  height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr;
  padding: 18px;
  gap: 14px;
}

.hud {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.eyebrow {
  margin: 0 0 3px;
  color: var(--accent);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

h1 {
  margin: 0;
  font-size: 26px;
  letter-spacing: 0;
}

.stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.stats span {
  min-width: 94px;
  padding: 8px 10px;
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 8px;
  background: rgba(255,255,255,0.08);
}

.stage {
  position: relative;
  min-height: 0;
  border: 1px solid rgba(255,255,255,0.16);
  border-radius: 8px;
  overflow: hidden;
  background: #020617;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  gap: 14px;
  padding: 30px;
  text-align: center;
  background: rgba(2,6,23,0.72);
}

.overlay[hidden] { display: none; }

.overlay h2 {
  margin: 0;
  font-size: 44px;
}

.overlay p {
  max-width: 680px;
  margin: 0 auto;
  color: #dbe4ee;
  line-height: 1.55;
}

button {
  width: fit-content;
  min-width: 132px;
  margin: 0 auto;
  border: 0;
  border-radius: 8px;
  padding: 12px 18px;
  color: #06111c;
  background: var(--accent);
  font-weight: 800;
  cursor: pointer;
}

.status { font-size: 14px; }

@media (max-width: 700px) {
  .shell { padding: 10px; }
  .hud { align-items: flex-start; flex-direction: column; }
  h1 { font-size: 22px; }
  .overlay h2 { font-size: 30px; }
  .stats span { min-width: 82px; }
}`;

  const gameJs = `(() => {
  const config = ${JSON.stringify(config)};
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const timeEl = document.getElementById("time");
  const overlay = document.getElementById("overlay");
  const startBtn = document.getElementById("start");
  const restartBtn = document.getElementById("restart");
  const statusEl = document.getElementById("status");
  const keys = {};
  const state = {
    running: false,
    over: false,
    score: 0,
    lives: 3,
    elapsed: 0,
    lastTime: 0,
    nextHazard: 0,
    nextPickup: 0,
    hazards: [],
    pickups: [],
    player: { x: 148, y: 270, radius: 18 }
  };

  function seededRandom() {
    config.seed = (config.seed * 1664525 + 1013904223) >>> 0;
    return config.seed / 4294967296;
  }

  function emit(type, payload = {}) {
    parent.postMessage({ source: "ai-arcade-game", type, payload }, "*");
  }

  function resize() {
    const ratio = canvas.width / canvas.height;
    const rect = canvas.getBoundingClientRect();
    if (rect.width / rect.height > ratio) {
      canvas.style.width = Math.floor(rect.height * ratio) + "px";
      canvas.style.height = "100%";
    } else {
      canvas.style.width = "100%";
      canvas.style.height = Math.floor(rect.width / ratio) + "px";
    }
  }

  function reset() {
    state.running = true;
    state.over = false;
    state.score = 0;
    state.lives = 3;
    state.elapsed = 0;
    state.lastTime = performance.now();
    state.nextHazard = 0;
    state.nextPickup = 0;
    state.hazards = [];
    state.pickups = [];
    state.player = { x: 148, y: 270, radius: 18 };
    overlay.hidden = true;
    restartBtn.hidden = true;
    statusEl.textContent = "Collect " + config.labels.pickup + " and dodge " + config.labels.hazard + ".";
    emit("play_start", { title: config.title });
    requestAnimationFrame(loop);
  }

  function endGame(reason) {
    state.running = false;
    state.over = true;
    overlay.hidden = false;
    restartBtn.hidden = false;
    startBtn.hidden = true;
    statusEl.textContent = reason + " Final score: " + state.score + ".";
    emit("game_over", { reason, score: state.score, lives: state.lives });
  }

  function spawnHazard() {
    const radius = 14 + Math.floor(seededRandom() * 22);
    state.hazards.push({
      x: canvas.width + radius,
      y: 40 + seededRandom() * (canvas.height - 80),
      radius,
      speed: (150 + seededRandom() * 180) * config.speedMultiplier,
      wobble: seededRandom() * 6.28
    });
  }

  function spawnPickup() {
    const radius = 10 + Math.floor(seededRandom() * 8);
    state.pickups.push({
      x: canvas.width + radius,
      y: 42 + seededRandom() * (canvas.height - 84),
      radius,
      speed: (110 + seededRandom() * 110) * config.speedMultiplier
    });
  }

  function update(dt) {
    state.elapsed += dt;
    state.nextHazard -= dt;
    state.nextPickup -= dt;
    if (state.nextHazard <= 0) {
      spawnHazard();
      state.nextHazard = Math.max(0.32, 0.86 - state.elapsed / 85);
    }
    if (state.nextPickup <= 0) {
      spawnPickup();
      state.nextPickup = 1.1 + seededRandom() * 0.55;
    }

    const speed = 270;
    const dx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    const dy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
    const length = Math.hypot(dx, dy) || 1;
    state.player.x = Math.max(24, Math.min(canvas.width - 24, state.player.x + (dx / length) * speed * dt));
    state.player.y = Math.max(24, Math.min(canvas.height - 24, state.player.y + (dy / length) * speed * dt));

    for (const hazard of state.hazards) {
      hazard.x -= hazard.speed * dt;
      hazard.y += Math.sin(state.elapsed * 4 + hazard.wobble) * 20 * dt;
    }
    for (const pickup of state.pickups) {
      pickup.x -= pickup.speed * dt;
    }

    state.hazards = state.hazards.filter((hazard) => hazard.x > -hazard.radius);
    state.pickups = state.pickups.filter((pickup) => pickup.x > -pickup.radius);

    for (const hazard of state.hazards) {
      if (Math.hypot(hazard.x - state.player.x, hazard.y - state.player.y) < hazard.radius + state.player.radius) {
        hazard.x = -999;
        state.lives -= 1;
        state.score = Math.max(0, state.score - 20);
      }
    }
    for (const pickup of state.pickups) {
      if (Math.hypot(pickup.x - state.player.x, pickup.y - state.player.y) < pickup.radius + state.player.radius) {
        pickup.x = -999;
        state.score += 15;
      }
    }
    state.pickups = state.pickups.filter((pickup) => pickup.x > -100);

    const remaining = Math.max(0, Math.ceil(config.duration - state.elapsed));
    scoreEl.textContent = String(state.score + Math.floor(state.elapsed));
    livesEl.textContent = String(state.lives);
    timeEl.textContent = String(remaining);

    if (state.lives <= 0) endGame("All lives lost.");
    if (state.elapsed >= config.duration) {
      state.score += state.lives * 50;
      endGame("Timer complete.");
    }
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, config.theme.background);
    gradient.addColorStop(1, "#020617");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = config.theme.primary;
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 97 + config.seed) % canvas.width;
      const y = (i * 53 + config.seed / 3) % canvas.height;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    drawBackground();
    ctx.fillStyle = config.theme.primary;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, state.player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = config.theme.accent;
    ctx.beginPath();
    ctx.moveTo(state.player.x + 24, state.player.y);
    ctx.lineTo(state.player.x - 14, state.player.y - 14);
    ctx.lineTo(state.player.x - 8, state.player.y);
    ctx.lineTo(state.player.x - 14, state.player.y + 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = config.theme.danger;
    for (const hazard of state.hazards) {
      ctx.beginPath();
      ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.stroke();
    }

    ctx.fillStyle = config.theme.accent;
    for (const pickup of state.pickups) {
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop(now) {
    if (!state.running) return;
    const dt = Math.min(0.05, (now - state.lastTime) / 1000);
    state.lastTime = now;
    update(dt);
    draw();
    if (state.running) requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", (event) => { keys[event.code] = true; });
  window.addEventListener("keyup", (event) => { keys[event.code] = false; });
  window.addEventListener("resize", resize);
  canvas.addEventListener("pointermove", (event) => {
    if (!state.running) return;
    const rect = canvas.getBoundingClientRect();
    state.player.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    state.player.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  startBtn.addEventListener("click", reset);
  restartBtn.addEventListener("click", () => {
    emit("restart", { title: config.title });
    reset();
  });
  resize();
  draw();
})();`;

  return { indexHtml, gameJs, styleCss };
}
