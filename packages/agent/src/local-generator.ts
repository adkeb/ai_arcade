import type {
  AssetSummary,
  GameDesignSpec,
  GameSourceFiles,
  IntentPlan,
} from "./types";

type LocalGameMode = NonNullable<IntentPlan["mode"]>;

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

function assetContext(assets: AssetSummary[]): string {
  return assets
    .map((asset) =>
      [
        asset.originalName,
        asset.analysis?.summary,
        asset.analysis?.textExcerpt,
        asset.analysis?.metadata ? JSON.stringify(asset.analysis.metadata) : "",
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join("\n");
}

function inferGameMode(context: string): LocalGameMode {
  const isMemory = hasAny(context, [
    "memory",
    "match",
    "matching",
    "pair",
    "card",
    "记忆",
    "配对",
    "匹配",
    "翻牌",
    "卡牌",
  ]);
  const isGarden = hasAny(context, [
    "garden",
    "flower",
    "bloom",
    "seed",
    "花园",
    "花",
    "种植",
    "园艺",
  ]);
  const isRunner = hasAny(context, [
    "runner",
    "run",
    "dash",
    "parkour",
    "side-scroller",
    "跑酷",
    "奔跑",
    "横版",
  ]);
  const isPuzzle = hasAny(context, [
    "puzzle",
    "logic",
    "sequence",
    "pattern",
    "解谜",
    "谜题",
    "序列",
    "规律",
  ]);

  if (isMemory) return "memory-match";
  if (isGarden) return "garden-sequence";
  if (isPuzzle) return "memory-match";
  if (isRunner) return "runner";
  return "avoid-collect";
}

function modeFromIntent(intent: IntentPlan): LocalGameMode {
  if (intent.mode) return intent.mode;
  const genre = intent.genre.toLowerCase();
  if (
    genre.includes("memory") ||
    genre.includes("match") ||
    genre.includes("puzzle")
  )
    return "memory-match";
  if (
    genre.includes("garden") ||
    genre.includes("sequence") ||
    genre.includes("pattern")
  )
    return "garden-sequence";
  if (genre.includes("runner") || genre.includes("dash")) return "runner";
  return "avoid-collect";
}

export function planIntentFromPrompt(
  prompt: string,
  assets: AssetSummary[],
): IntentPlan {
  const seed = hashText(
    `${prompt}:${assets.map((asset) => asset.originalName).join("|")}`,
  );
  const context = `${prompt}\n${assetContext(assets)}`;
  const mode = inferGameMode(context);
  const isSpace = hasAny(context, [
    "space",
    "ship",
    "asteroid",
    "太空",
    "飞船",
    "陨石",
    "能量",
  ]);
  const isCyber = hasAny(context, ["cyber", "neon", "赛博", "霓虹"]);
  const isGarden = hasAny(context, [
    "garden",
    "flower",
    "bloom",
    "seed",
    "花园",
    "花",
    "种植",
    "园艺",
  ]);
  const hasAssetAnalysis = assets.some((asset) =>
    Boolean(asset.analysis?.summary || asset.analysis?.textExcerpt),
  );

  const genre =
    mode === "memory-match"
      ? "memory matching puzzle"
      : mode === "garden-sequence"
        ? "garden sequence puzzle"
        : mode === "runner"
          ? "side-scrolling arcade runner"
          : "avoid-and-collect arcade";
  const artStyle = isCyber
    ? "neon cyberpunk"
    : isGarden
      ? "soft botanical pixel art"
      : isSpace
        ? "pixel space opera"
        : pick(
            [
              "crisp arcade pixel art",
              "paper-cut toy world",
              "retro synth arcade",
            ],
            seed,
          );

  const entities = isGarden
    ? ["garden keeper", "memory blooms", "pattern beds"]
    : mode === "memory-match"
      ? ["card cursor", "matching tiles", "memory symbols"]
      : mode === "runner"
        ? ["runner avatar", "barriers", "spark tokens"]
        : isSpace
          ? ["pilot ship", "asteroids", "energy cores"]
          : ["player avatar", "hazards", "score orbs"];

  const mechanicsByMode: Record<LocalGameMode, string[]> = {
    "avoid-collect": [
      "move within a bounded canvas",
      "avoid fast hazards",
      "collect score items",
      hasAssetAnalysis
        ? "use uploaded asset analysis as theme and entity inspiration"
        : assets.length > 0
          ? "reference uploaded material metadata as visual inspiration"
          : "procedurally vary colors from prompt",
    ],
    "memory-match": [
      "flip hidden cards on a grid",
      "remember symbol positions",
      "match every pair before time expires",
      hasAssetAnalysis
        ? "turn uploaded asset content into card motifs"
        : "seed card symbols from prompt",
    ],
    runner: [
      "jump through a side-scrolling lane",
      "time jumps around barriers",
      "collect airborne tokens for bonus score",
      hasAssetAnalysis
        ? "use uploaded asset analysis as runner scenery inspiration"
        : "vary obstacle cadence from prompt",
    ],
    "garden-sequence": [
      "watch a highlighted garden pattern",
      "repeat the bloom sequence by clicking beds",
      "grow longer sequences across rounds",
      hasAssetAnalysis
        ? "use uploaded asset analysis as planting motif inspiration"
        : "seed bloom order from prompt",
    ],
  };

  const goalsByMode: Record<
    LocalGameMode,
    Pick<
      IntentPlan,
      "playerGoal" | "winCondition" | "loseCondition" | "controls"
    >
  > = {
    "avoid-collect": {
      playerGoal:
        "survive the full timer while collecting as many rewards as possible",
      winCondition: "timer reaches zero with at least one life remaining",
      loseCondition: "all lives are lost before the timer ends",
      controls: ["Arrow keys", "WASD", "mouse or touch drag"],
    },
    "memory-match": {
      playerGoal: "reveal and match all hidden pairs before the timer expires",
      winCondition: "all pairs are matched",
      loseCondition: "timer expires or too many mismatches remove all lives",
      controls: ["mouse or touch tap"],
    },
    runner: {
      playerGoal:
        "jump over barriers, collect tokens, and keep running until the timer ends",
      winCondition: "timer reaches zero while the runner still has lives",
      loseCondition: "all lives are lost to collisions",
      controls: ["Space", "ArrowUp", "W", "mouse or touch tap"],
    },
    "garden-sequence": {
      playerGoal:
        "memorize each bloom pattern and repeat it to grow the garden",
      winCondition: "complete the target bloom sequence length",
      loseCondition: "all lives are lost after incorrect pattern inputs",
      controls: ["mouse or touch tap", "number keys 1-4"],
    },
  };

  return {
    genre,
    mode,
    coreMechanics: mechanicsByMode[mode],
    artStyle,
    playerGoal: goalsByMode[mode].playerGoal,
    winCondition: goalsByMode[mode].winCondition,
    loseCondition: goalsByMode[mode].loseCondition,
    controls: goalsByMode[mode].controls,
    entities,
    mood: isCyber
      ? "electric and tense"
      : isGarden
        ? "calm and focused"
        : mode === "memory-match"
          ? "clever and deliberate"
          : "fast and playful",
    seed,
  };
}

export function designGameFromIntent(
  prompt: string,
  intent: IntentPlan,
): GameDesignSpec {
  const mode = modeFromIntent(intent);
  const titlePoolByMode: Record<LocalGameMode, string[]> = {
    "avoid-collect": intent.artStyle.includes("space")
      ? ["Asteroid Energy Run", "Orbit Spark Dash", "Cosmic Core Drift"]
      : intent.artStyle.includes("cyber")
        ? ["Neon Drift", "Circuit Rush", "Chrome Pulse"]
        : ["Pixel Runner", "Arcade Spark", "Signal Sprint"],
    "memory-match": intent.artStyle.includes("botanical")
      ? ["Memory Garden", "Bloom Recall", "Petal Pairs"]
      : intent.artStyle.includes("cyber")
        ? ["Neon Memory Grid", "Circuit Pairs", "Chrome Recall"]
        : ["Signal Match", "Tile Recall", "Pattern Pairs"],
    runner: intent.artStyle.includes("space")
      ? ["Orbit Runner", "Asteroid Lane", "Comet Sprint"]
      : intent.artStyle.includes("cyber")
        ? ["Circuit Rush", "Neon Vault", "Chrome Runner"]
        : ["Pixel Vault", "Dashline", "Spark Runner"],
    "garden-sequence": ["Bloom Signal", "Petal Pattern", "Garden Echo"],
  };

  const title = pick(titlePoolByMode[mode], intent.seed);
  const difficulty =
    intent.seed % 5 === 0 ? "hard" : intent.seed % 2 === 0 ? "medium" : "easy";
  const durationSeconds = hasAny(prompt, ["30", "三十", "half minute"])
    ? 30
    : mode === "memory-match"
      ? 60
      : mode === "garden-sequence"
        ? 55
        : difficulty === "hard"
          ? 45
          : 35;
  const palette = intent.artStyle.includes("cyber")
    ? {
        background: "#17151f",
        primary: "#18d6c5",
        accent: "#ffd166",
        danger: "#ff5c8a",
      }
    : intent.artStyle.includes("botanical")
      ? {
          background: "#18231f",
          primary: "#9be564",
          accent: "#f6d365",
          danger: "#f25f5c",
        }
      : intent.artStyle.includes("space")
        ? {
            background: "#101827",
            primary: "#7dd3fc",
            accent: "#facc15",
            danger: "#fb7185",
          }
        : {
            background: "#16181d",
            primary: "#70e000",
            accent: "#fbbf24",
            danger: "#f97316",
          };

  const tags = Array.from(
    new Set([
      mode,
      intent.artStyle.includes("cyber")
        ? "cyberpunk"
        : intent.artStyle.includes("space")
          ? "space"
          : "pixel",
      difficulty,
      "agent-generated",
    ]),
  );

  const loopByMode: Record<LocalGameMode, string> = {
    "avoid-collect":
      "Start the round, move through incoming hazards, collect glowing rewards, and finish with a score summary.",
    "memory-match":
      "Reveal two cards at a time, memorize the hidden symbols, match every pair, and protect your remaining lives.",
    runner:
      "Start running, jump over side-scrolling barriers, grab airborne tokens, and survive until the timer ends.",
    "garden-sequence":
      "Watch the highlighted bloom order, repeat the pattern on the garden beds, and grow longer sequences each round.",
  };

  const scoringByMode: Record<LocalGameMode, string> = {
    "avoid-collect":
      "Rewards add points, survival time adds a bonus, collisions remove lives.",
    "memory-match":
      "Matched pairs add points, quick matches earn a bonus, wrong pairs remove lives.",
    runner:
      "Distance and tokens add points, collisions remove lives, remaining lives add a finish bonus.",
    "garden-sequence":
      "Correct pattern steps add points, completed rounds add bonuses, wrong inputs remove lives.",
  };

  return {
    title,
    description: `${title} is a ${intent.mood} ${intent.genre} game generated from: ${prompt.slice(0, 140)}${
      prompt.length > 140 ? "..." : ""
    }`,
    tags,
    coverPrompt: `${intent.artStyle} cover for ${title}, ${intent.entities.join(", ")}`,
    gameplayLoop: loopByMode[mode],
    controls: intent.controls,
    scoring: scoringByMode[mode],
    difficulty,
    runtimeRequirements: [
      "HTML5 Canvas",
      "keyboard input",
      "pointer input",
      "postMessage telemetry",
    ],
    theme: palette,
    durationSeconds,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[char] ?? char;
  });
}

export function generateCoverSvg(design: GameDesignSpec): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540" role="img" aria-label="${escapeHtml(
    design.title,
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
    design.title,
  )}</text>
  <text x="86" y="438" fill="#f8fafc" font-family="Arial, sans-serif" font-size="24">${escapeHtml(
    design.tags.slice(0, 3).join(" / "),
  )}</text>
</svg>`;
}

export function generateGameFiles(
  design: GameDesignSpec,
  intent: IntentPlan,
): GameSourceFiles {
  const mode = modeFromIntent(intent);
  const config = {
    title: design.title,
    description: design.description,
    mode,
    duration: design.durationSeconds,
    difficulty: design.difficulty,
    theme: design.theme,
    labels: {
      player: intent.entities[0] ?? "player",
      hazard: intent.entities[1] ?? "hazard",
      pickup: intent.entities[2] ?? "reward",
    },
    seed: intent.seed,
    speedMultiplier:
      design.difficulty === "hard"
        ? 1.3
        : design.difficulty === "medium"
          ? 1.1
          : 0.92,
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
  const baseSeed = config.seed;
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
    nextObstacle: 0,
    nextToken: 0,
    hazards: [],
    pickups: [],
    obstacles: [],
    tokens: [],
    cards: [],
    selectedCards: [],
    lockTimer: 0,
    sequence: [],
    sequenceInput: 0,
    sequenceTarget: 6,
    showingSequence: false,
    showIndex: -1,
    showTimer: 0,
    activePlot: -1,
    player: { x: 148, y: 270, radius: 18 },
    runner: { x: 150, y: 386, width: 38, height: 50, vy: 0, grounded: true }
  };

  function seededRandom() {
    config.seed = (config.seed * 1664525 + 1013904223) >>> 0;
    return config.seed / 4294967296;
  }

  function emit(type, payload) {
    parent.postMessage({ source: "ai-arcade-game", type, payload: payload || {} }, "*");
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

  function pointFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function updateHud() {
    const remaining = Math.max(0, Math.ceil(config.duration - state.elapsed));
    scoreEl.textContent = String(Math.max(0, Math.floor(state.score)));
    livesEl.textContent = String(Math.max(0, state.lives));
    timeEl.textContent = String(remaining);
  }

  function endGame(reason) {
    if (!state.running) return;
    state.running = false;
    state.over = true;
    overlay.hidden = false;
    restartBtn.hidden = false;
    startBtn.hidden = true;
    updateHud();
    statusEl.textContent = reason + " Final score: " + Math.max(0, Math.floor(state.score)) + ".";
    emit("game_over", { reason, score: Math.max(0, Math.floor(state.score)), lives: state.lives });
  }

  function setupMemoryMatch() {
    const pairCount = config.difficulty === "hard" ? 8 : config.difficulty === "medium" ? 6 : 5;
    const values = "ABCDEFGH".slice(0, pairCount).split("");
    const deck = values.concat(values);
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(seededRandom() * (index + 1));
      const value = deck[index];
      deck[index] = deck[swapIndex];
      deck[swapIndex] = value;
    }
    const columns = 4;
    const cardWidth = 142;
    const cardHeight = 86;
    const gap = 16;
    const rows = Math.ceil(deck.length / columns);
    const startX = (canvas.width - columns * cardWidth - (columns - 1) * gap) / 2;
    const startY = (canvas.height - rows * cardHeight - (rows - 1) * gap) / 2 + 18;
    state.cards = deck.map((value, index) => ({
      id: index,
      value,
      x: startX + (index % columns) * (cardWidth + gap),
      y: startY + Math.floor(index / columns) * (cardHeight + gap),
      width: cardWidth,
      height: cardHeight,
      flipped: false,
      matched: false
    }));
    state.selectedCards = [];
    state.lockTimer = 0;
    statusEl.textContent = "Flip two cards, remember symbols, and match every pair.";
  }

  function startSequenceDisplay() {
    state.showingSequence = true;
    state.showIndex = -1;
    state.showTimer = 0.25;
    state.sequenceInput = 0;
    state.activePlot = -1;
    statusEl.textContent = "Watch the bloom order.";
  }

  function setupGardenSequence() {
    state.sequence = [Math.floor(seededRandom() * 4), Math.floor(seededRandom() * 4)];
    state.sequenceTarget = config.difficulty === "hard" ? 8 : config.difficulty === "medium" ? 7 : 6;
    startSequenceDisplay();
  }

  function setupRunner() {
    state.runner = { x: 150, y: 386, width: 38, height: 50, vy: 0, grounded: true };
    state.obstacles = [];
    state.tokens = [];
    state.nextObstacle = 0.4;
    state.nextToken = 0.9;
    statusEl.textContent = "Jump with Space, ArrowUp, W, or tap. Collect tokens and avoid barriers.";
  }

  function setupAvoidCollect() {
    state.player = { x: 148, y: 270, radius: 18 };
    state.hazards = [];
    state.pickups = [];
    state.nextHazard = 0;
    state.nextPickup = 0.4;
    statusEl.textContent = "Collect " + config.labels.pickup + " and dodge " + config.labels.hazard + ".";
  }

  function reset() {
    config.seed = baseSeed;
    state.running = true;
    state.over = false;
    state.score = 0;
    state.lives = 3;
    state.elapsed = 0;
    state.lastTime = performance.now();
    overlay.hidden = true;
    restartBtn.hidden = true;
    startBtn.hidden = false;
    if (config.mode === "memory-match") setupMemoryMatch();
    else if (config.mode === "garden-sequence") setupGardenSequence();
    else if (config.mode === "runner") setupRunner();
    else setupAvoidCollect();
    updateHud();
    emit("play_start", { title: config.title, mode: config.mode });
    requestAnimationFrame(loop);
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

  function updateAvoidCollect(dt) {
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
    for (const pickup of state.pickups) pickup.x -= pickup.speed * dt;
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
    state.score += dt * 2;
    updateHud();
    if (state.lives <= 0) endGame("All lives lost.");
    else if (state.elapsed >= config.duration) {
      state.score += state.lives * 50;
      endGame("Timer complete.");
    }
  }

  function updateMemoryMatch(dt) {
    state.elapsed += dt;
    if (state.lockTimer > 0) {
      state.lockTimer -= dt;
      if (state.lockTimer <= 0) {
        for (const card of state.selectedCards) card.flipped = false;
        state.selectedCards = [];
      }
    }
    updateHud();
    if (state.elapsed >= config.duration) endGame("Time expired.");
  }

  function jumpRunner() {
    if (!state.running || config.mode !== "runner" || !state.runner.grounded) return;
    state.runner.vy = -610;
    state.runner.grounded = false;
  }

  function spawnRunnerObstacle() {
    const height = 34 + Math.floor(seededRandom() * 44);
    state.obstacles.push({
      x: canvas.width + 20,
      y: 436 - height,
      width: 28 + Math.floor(seededRandom() * 28),
      height,
      speed: (225 + seededRandom() * 100) * config.speedMultiplier
    });
  }

  function spawnRunnerToken() {
    state.tokens.push({
      x: canvas.width + 24,
      y: 245 + seededRandom() * 130,
      radius: 12,
      speed: (220 + seededRandom() * 90) * config.speedMultiplier
    });
  }

  function updateRunner(dt) {
    state.elapsed += dt;
    state.score += dt * 7;
    state.nextObstacle -= dt;
    state.nextToken -= dt;
    if (state.nextObstacle <= 0) {
      spawnRunnerObstacle();
      state.nextObstacle = Math.max(0.72, 1.35 - state.elapsed / 85) + seededRandom() * 0.35;
    }
    if (state.nextToken <= 0) {
      spawnRunnerToken();
      state.nextToken = 0.95 + seededRandom() * 0.85;
    }

    const runner = state.runner;
    runner.vy += 1320 * dt;
    runner.y += runner.vy * dt;
    if (runner.y + runner.height >= 436) {
      runner.y = 436 - runner.height;
      runner.vy = 0;
      runner.grounded = true;
    }

    for (const obstacle of state.obstacles) obstacle.x -= obstacle.speed * dt;
    for (const token of state.tokens) token.x -= token.speed * dt;
    state.obstacles = state.obstacles.filter((obstacle) => obstacle.x + obstacle.width > -10);
    state.tokens = state.tokens.filter((token) => token.x + token.radius > -10);

    for (const obstacle of state.obstacles) {
      const hit = runner.x < obstacle.x + obstacle.width && runner.x + runner.width > obstacle.x && runner.y < obstacle.y + obstacle.height && runner.y + runner.height > obstacle.y;
      if (hit) {
        obstacle.x = -999;
        state.lives -= 1;
        state.score = Math.max(0, state.score - 25);
      }
    }
    for (const token of state.tokens) {
      const closestX = Math.max(runner.x, Math.min(token.x, runner.x + runner.width));
      const closestY = Math.max(runner.y, Math.min(token.y, runner.y + runner.height));
      if (Math.hypot(token.x - closestX, token.y - closestY) < token.radius) {
        token.x = -999;
        state.score += 20;
      }
    }
    state.tokens = state.tokens.filter((token) => token.x > -100);
    updateHud();
    if (state.lives <= 0) endGame("All lives lost.");
    else if (state.elapsed >= config.duration) {
      state.score += state.lives * 60;
      endGame("Finish line reached.");
    }
  }

  function gardenPlots() {
    return [
      { x: 260, y: 185, radius: 70 },
      { x: 700, y: 185, radius: 70 },
      { x: 260, y: 380, radius: 70 },
      { x: 700, y: 380, radius: 70 }
    ];
  }

  function handleGardenPlot(index) {
    if (!state.running || config.mode !== "garden-sequence" || state.showingSequence) return;
    state.activePlot = index;
    if (state.sequence[state.sequenceInput] === index) {
      state.score += 12;
      state.sequenceInput += 1;
      if (state.sequenceInput >= state.sequence.length) {
        state.score += state.sequence.length * 28;
        if (state.sequence.length >= state.sequenceTarget) {
          endGame("Garden complete.");
          return;
        }
        state.sequence.push(Math.floor(seededRandom() * 4));
        startSequenceDisplay();
      } else {
        statusEl.textContent = "Correct. Continue the pattern.";
      }
    } else {
      state.lives -= 1;
      state.sequenceInput = 0;
      statusEl.textContent = "Pattern reset. Watch again.";
      if (state.lives <= 0) {
        endGame("All lives lost.");
        return;
      }
      startSequenceDisplay();
    }
    updateHud();
  }

  function updateGardenSequence(dt) {
    state.elapsed += dt;
    if (state.showingSequence) {
      state.showTimer -= dt;
      if (state.showTimer <= 0) {
        if (state.activePlot >= 0) {
          state.activePlot = -1;
          state.showTimer = 0.18;
        } else {
          state.showIndex += 1;
          if (state.showIndex >= state.sequence.length) {
            state.showingSequence = false;
            state.sequenceInput = 0;
            statusEl.textContent = "Repeat the bloom order.";
          } else {
            state.activePlot = state.sequence[state.showIndex];
            state.showTimer = 0.54;
          }
        }
      }
    }
    updateHud();
    if (state.elapsed >= config.duration) endGame("Time expired.");
  }

  function update(dt) {
    if (config.mode === "memory-match") updateMemoryMatch(dt);
    else if (config.mode === "garden-sequence") updateGardenSequence(dt);
    else if (config.mode === "runner") updateRunner(dt);
    else updateAvoidCollect(dt);
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, config.theme.background);
    gradient.addColorStop(1, "#020617");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = config.theme.primary;
    for (let i = 0; i < 44; i += 1) {
      const x = (i * 97 + baseSeed) % canvas.width;
      const y = (i * 53 + baseSeed / 3) % canvas.height;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  function drawAvoidCollect() {
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

  function drawMemoryMatch() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const card of state.cards) {
      const open = card.flipped || card.matched;
      ctx.fillStyle = open ? config.theme.accent : "rgba(255,255,255,0.1)";
      ctx.strokeStyle = card.matched ? config.theme.primary : "rgba(255,255,255,0.32)";
      ctx.lineWidth = card.matched ? 5 : 2;
      ctx.fillRect(card.x, card.y, card.width, card.height);
      ctx.strokeRect(card.x, card.y, card.width, card.height);
      ctx.fillStyle = open ? "#06111c" : "rgba(255,255,255,0.74)";
      ctx.font = open ? "700 38px Arial" : "700 18px Arial";
      ctx.fillText(open ? card.value : "?", card.x + card.width / 2, card.y + card.height / 2);
    }
  }

  function drawRunner() {
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(0, 436, canvas.width, 4);
    ctx.fillStyle = config.theme.primary;
    ctx.fillRect(state.runner.x, state.runner.y, state.runner.width, state.runner.height);
    ctx.fillStyle = config.theme.accent;
    ctx.fillRect(state.runner.x + state.runner.width - 8, state.runner.y + 10, 8, 14);
    ctx.fillStyle = config.theme.danger;
    for (const obstacle of state.obstacles) ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    ctx.fillStyle = config.theme.accent;
    for (const token of state.tokens) {
      ctx.beginPath();
      ctx.arc(token.x, token.y, token.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGardenSequence() {
    const plots = gardenPlots();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    plots.forEach((plot, index) => {
      const active = index === state.activePlot;
      ctx.fillStyle = active ? config.theme.accent : "rgba(255,255,255,0.11)";
      ctx.strokeStyle = active ? config.theme.primary : "rgba(255,255,255,0.3)";
      ctx.lineWidth = active ? 7 : 3;
      ctx.beginPath();
      ctx.arc(plot.x, plot.y, plot.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = active ? "#06111c" : "#f8fafc";
      ctx.font = "800 36px Arial";
      ctx.fillText(String(index + 1), plot.x, plot.y);
    });
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "700 18px Arial";
    ctx.fillText("Round " + state.sequence.length + " / " + state.sequenceTarget, canvas.width / 2, 62);
  }

  function draw() {
    drawBackground();
    if (config.mode === "memory-match") drawMemoryMatch();
    else if (config.mode === "garden-sequence") drawGardenSequence();
    else if (config.mode === "runner") drawRunner();
    else drawAvoidCollect();
  }

  function loop(now) {
    if (!state.running) return;
    const dt = Math.min(0.05, (now - state.lastTime) / 1000);
    state.lastTime = now;
    update(dt);
    draw();
    if (state.running) requestAnimationFrame(loop);
  }

  function handleMemoryTap(point) {
    if (!state.running || config.mode !== "memory-match" || state.lockTimer > 0) return;
    const card = state.cards.find((item) => point.x >= item.x && point.x <= item.x + item.width && point.y >= item.y && point.y <= item.y + item.height);
    if (!card || card.flipped || card.matched) return;
    card.flipped = true;
    state.selectedCards.push(card);
    if (state.selectedCards.length === 2) {
      const first = state.selectedCards[0];
      const second = state.selectedCards[1];
      if (first.value === second.value) {
        first.matched = true;
        second.matched = true;
        state.selectedCards = [];
        state.score += 50;
        if (state.cards.every((item) => item.matched)) {
          state.score += state.lives * 75 + Math.max(0, config.duration - state.elapsed) * 3;
          endGame("All pairs matched.");
        }
      } else {
        state.lives -= 1;
        state.score = Math.max(0, state.score - 10);
        state.lockTimer = 0.72;
        if (state.lives <= 0) endGame("All lives lost.");
      }
    }
    updateHud();
    draw();
  }

  canvas.addEventListener("pointerdown", (event) => {
    const point = pointFromEvent(event);
    if (config.mode === "memory-match") handleMemoryTap(point);
    else if (config.mode === "garden-sequence") {
      const plotIndex = gardenPlots().findIndex((plot) => Math.hypot(point.x - plot.x, point.y - plot.y) <= plot.radius);
      if (plotIndex >= 0) handleGardenPlot(plotIndex);
    } else if (config.mode === "runner") {
      jumpRunner();
    }
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!state.running || config.mode !== "avoid-collect") return;
    const point = pointFromEvent(event);
    state.player.x = point.x;
    state.player.y = point.y;
  });

  window.addEventListener("keydown", (event) => {
    keys[event.code] = true;
    if (config.mode === "runner" && (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW")) jumpRunner();
    if (config.mode === "garden-sequence" && event.code.startsWith("Digit")) {
      const value = Number(event.code.slice(5));
      if (value >= 1 && value <= 4) handleGardenPlot(value - 1);
    }
  });
  window.addEventListener("keyup", (event) => { keys[event.code] = false; });
  window.addEventListener("resize", resize);
  startBtn.addEventListener("click", reset);
  restartBtn.addEventListener("click", () => {
    emit("restart", { title: config.title, mode: config.mode });
    reset();
  });
  resize();
  updateHud();
  draw();
})();`;

  return { indexHtml, gameJs, styleCss };
}
