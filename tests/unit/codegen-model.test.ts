import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import test from "node:test";
import { runCodeGenAgent } from "@ai-arcade/agent/agents/code-gen";
import type { GameDesignSpec, IntentPlan } from "@ai-arcade/agent/types";

type RecordedRequest = {
  authorization: string | undefined;
  body: Record<string, unknown>;
};

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
  return JSON.stringify({
    indexHtml:
      "<!doctype html><html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'\"><link rel=\"stylesheet\" href=\"./style.css\"></head><body><main><canvas id=\"game\"></canvas></main><script src=\"./game.js\" defer></script></body></html>",
    gameJs: `window.__remoteCodegenMarker = "${marker}"; window.addEventListener("load", () => requestAnimationFrame(() => {}));`,
    styleCss:
      "body{margin:0;background:#101820;color:white}canvas{display:block}",
  });
}

async function withMockChatServer<T>(
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
    response.end(
      JSON.stringify({
        choices: [{ message: { content: remoteGameJson("mock-llm") } }],
      }),
    );
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
    process.env.USE_LOCAL_AGENT_FALLBACK = previous.fallback;
    process.env.OPENAI_API_KEY = previous.apiKey;
    process.env.OPENAI_BASE_URL = previous.baseUrl;
    process.env.OPENAI_MODEL = previous.model;
    process.env.OPENAI_ENABLE_THINKING = previous.thinking;
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
  await withMockChatServer(async (requests) => {
    const files = await runCodeGenAgent(design, intent);

    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.authorization, "Bearer test-model-key");
    assert.equal(requests[0]?.body.model, "mock-json-model");
    assert.equal(files.gameJs.includes("mock-llm"), true);
    assert.equal(files.indexHtml.includes("Content-Security-Policy"), true);
    assert.equal(files.styleCss.includes("canvas"), true);
  });
});
