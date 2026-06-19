import { callOpenAICompatibleJson } from "../model-provider";
import { generateGameFiles } from "../local-generator";
import type { GameDesignSpec, GameSourceFiles, IntentPlan } from "../types";

const MAX_SOURCE_LENGTH = 120_000;
const REQUIRED_CSP_PARTS = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
];

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
  const csp = extractCsp(indexHtml);
  if (!csp || /unsafe-inline|unsafe-eval/i.test(csp)) return null;
  if (!REQUIRED_CSP_PARTS.every((part) => csp.includes(part))) return null;
  if (
    !/(?:requestAnimationFrame|addEventListener|setInterval|onclick|pointer)/i.test(
      gameJs,
    )
  )
    return null;

  return { indexHtml, gameJs, styleCss };
}

function extractCsp(indexHtml: string): string {
  const metas = indexHtml.match(/<meta\b[^>]*>/gi) ?? [];
  const cspMeta = metas.find((meta) =>
    /http-equiv=["']content-security-policy["']/i.test(meta),
  );
  return cspMeta?.match(/\bcontent=(["'])(.*?)\1/i)?.[2] ?? "";
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
          "indexHtml must include a meta Content-Security-Policy with default-src 'none', script-src 'self', style-src 'self', connect-src 'none', base-uri 'none', form-action 'none', and object-src 'none'",
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
