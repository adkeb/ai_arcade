import { callOpenAICompatibleJson } from "../model-provider";
import { generateGameFiles } from "../local-generator";
import type { GameDesignSpec, GameSourceFiles, IntentPlan } from "../types";

const MAX_SOURCE_LENGTH = 120_000;

function stripFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(
    /^```(?:html|css|js|javascript)?\s*([\s\S]*?)\s*```$/i,
  );
  return fenced?.[1]?.trim() ?? trimmed;
}

function normalizeRemoteFiles(value: unknown): GameSourceFiles | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<Record<keyof GameSourceFiles, unknown>>;
  const indexHtml =
    typeof record.indexHtml === "string" ? stripFence(record.indexHtml) : "";
  const gameJs =
    typeof record.gameJs === "string" ? stripFence(record.gameJs) : "";
  const styleCss =
    typeof record.styleCss === "string" ? stripFence(record.styleCss) : "";

  if (!indexHtml || !gameJs || !styleCss) return null;
  if (
    indexHtml.length > MAX_SOURCE_LENGTH ||
    gameJs.length > MAX_SOURCE_LENGTH ||
    styleCss.length > MAX_SOURCE_LENGTH
  ) {
    return null;
  }
  if (!/<(?:!doctype\s+html|html|body|canvas|main)\b/i.test(indexHtml))
    return null;
  if (
    !/(?:requestAnimationFrame|addEventListener|setInterval|onclick|pointer)/i.test(
      gameJs,
    )
  )
    return null;

  return { indexHtml, gameJs, styleCss };
}

export async function runCodeGenAgent(
  design: GameDesignSpec,
  intent: IntentPlan,
): Promise<GameSourceFiles> {
  const remote = await callOpenAICompatibleJson<GameSourceFiles>([
    {
      role: "system",
      content:
        "You are CodeGenAgent for AI Arcade. Return strict JSON only with string fields indexHtml, gameJs, and styleCss. Build a complete playable browser game using only local files ./style.css and ./game.js. Do not use external scripts, remote assets, eval, Function constructor, storage APIs, cookies, network requests, WebSockets, geolocation, camera, microphone, or top-window access.",
    },
    {
      role: "user",
      content: JSON.stringify({
        design,
        intent,
        requirements: [
          "indexHtml must be a full HTML document that links ./style.css and defers ./game.js",
          "gameJs must implement actual game state, controls, scoring, win/lose conditions, restart, and animation or interaction",
          "styleCss must define responsive layout and readable in-game HUD styles",
          "Keep all code self-contained and deterministic enough for safety scanning",
        ],
      }),
    },
  ]);

  const remoteFiles = normalizeRemoteFiles(remote);
  if (remoteFiles) return remoteFiles;

  return generateGameFiles(design, intent);
}
