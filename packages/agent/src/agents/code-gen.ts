import {
  callOpenAICompatibleJson,
  shouldUseLocalFallback,
  type ChatMessage,
} from "../model-provider";
import { generateGameFiles } from "../local-generator";
import { runSafetyReviewAgent } from "./safety-review";
import type {
  AssetSummary,
  GameDesignSpec,
  GameSourceFiles,
  IntentPlan,
} from "../types";

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

export type CodeGenSource =
  | "remote-model"
  | "remote-repair-1"
  | "remote-repair-2"
  | "local-demo-fallback";

export type CodeGenAgentInput = {
  design: GameDesignSpec;
  intent: IntentPlan;
  assets?: AssetSummary[];
  regenerationContext?: {
    gameId?: string;
    previousTitle?: string;
    previousDescription?: string;
    previousTags?: string[];
    previousVersion?: number | null;
  } | null;
};

export type CodeGenAgentResult = GameSourceFiles & {
  source: CodeGenSource;
  repairAttempts: number;
  qualityFindings: string[];
};

function stripFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(
    /^```(?:html|css|js|javascript)?\s*([\s\S]*?)\s*```$/i,
  );
  return fenced?.[1]?.trim() ?? trimmed;
}

function normalizeRemoteFiles(value: unknown): {
  files: GameSourceFiles | null;
  findings: string[];
} {
  const findings: string[] = [];
  if (!value || typeof value !== "object") {
    return {
      files: null,
      findings: [
        "Model output must be a JSON object with indexHtml, gameJs, and styleCss string fields.",
      ],
    };
  }
  const record = value as Partial<Record<keyof GameSourceFiles, unknown>>;
  const indexHtml =
    typeof record.indexHtml === "string" ? stripFence(record.indexHtml) : "";
  const gameJs =
    typeof record.gameJs === "string" ? stripFence(record.gameJs) : "";
  const styleCss =
    typeof record.styleCss === "string" ? stripFence(record.styleCss) : "";

  if (!indexHtml) findings.push("Missing indexHtml string.");
  if (!gameJs) findings.push("Missing gameJs string.");
  if (!styleCss) findings.push("Missing styleCss string.");
  if (
    indexHtml.length > MAX_SOURCE_LENGTH ||
    gameJs.length > MAX_SOURCE_LENGTH ||
    styleCss.length > MAX_SOURCE_LENGTH
  ) {
    findings.push(
      "One or more generated source files exceed the source size limit.",
    );
  }
  if (!/<(?:!doctype\s+html|html|body|canvas|main)\b/i.test(indexHtml)) {
    findings.push(
      "indexHtml must be a complete HTML document with body/main/canvas.",
    );
  }
  const csp = extractCsp(indexHtml);
  if (!csp) findings.push("indexHtml is missing Content-Security-Policy meta.");
  if (/unsafe-inline|unsafe-eval/i.test(csp)) {
    findings.push("CSP must not include unsafe-inline or unsafe-eval.");
  }
  for (const part of REQUIRED_CSP_PARTS) {
    if (!csp.includes(part)) findings.push(`CSP is missing ${part}.`);
  }
  if (
    !/(?:requestAnimationFrame|addEventListener|setInterval|onclick|pointer)/i.test(
      gameJs,
    )
  )
    findings.push(
      "gameJs must include a playable loop or event-driven interaction.",
    );

  if (findings.length > 0) return { files: null, findings };

  return { files: { indexHtml, gameJs, styleCss }, findings };
}

function extractCsp(indexHtml: string): string {
  const metas = indexHtml.match(/<meta\b[^>]*>/gi) ?? [];
  const cspMeta = metas.find((meta) =>
    /http-equiv=["']content-security-policy["']/i.test(meta),
  );
  return cspMeta?.match(/\bcontent=(["'])(.*?)\1/i)?.[2] ?? "";
}

function summarizeAssets(assets: AssetSummary[]) {
  return assets.map((asset) => ({
    name: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.size,
    analysis: asset.analysis
      ? {
          summary: asset.analysis.summary,
          textExcerpt: asset.analysis.textExcerpt?.slice(0, 1600),
          metadata: asset.analysis.metadata,
        }
      : null,
  }));
}

function buildMessages(
  input: CodeGenAgentInput,
  repairFindings: string[],
): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are CodeGenAgent for AI Arcade. Return strict JSON only with string fields indexHtml, gameJs, and styleCss. Generate an original, production-quality, dependency-free browser game, not a tiny demo or template clone. Use only local files ./style.css and ./game.js. Do not use external scripts, remote assets, inline scripts/styles, eval, Function constructor, storage APIs, cookies, network requests, WebSockets, geolocation, camera, microphone, workers, dynamic imports, forms, frames, or top-window access.",
    },
    {
      role: "user",
      content: JSON.stringify({
        design: input.design,
        intent: input.intent,
        assets: summarizeAssets(input.assets ?? []),
        regenerationContext: input.regenerationContext ?? null,
        repairFeedback:
          repairFindings.length > 0
            ? {
                previousAttemptFailed: true,
                failureReasons: repairFindings.slice(0, 10),
                instruction:
                  "Regenerate all three files from scratch and directly fix every listed failure.",
              }
            : null,
        requirements: [
          "Create an original game loop that differs from deterministic local templates and avoids generic placeholder behavior",
          "indexHtml must be a full HTML document that links ./style.css and defers ./game.js",
          "indexHtml must include a meta Content-Security-Policy with default-src 'none', script-src 'self', style-src 'self', connect-src 'none', base-uri 'none', form-action 'none', and object-src 'none'",
          "gameJs must implement actual game state, input controls, scoring, win and failure conditions, restart, HUD updates, responsive canvas sizing, and an animation or interaction loop",
          "styleCss must define responsive layout, readable in-game HUD styles, buttons, overlay states, and mobile-friendly sizing",
          "Use player-facing labels, status text, and mechanics that match the prompt, design, assets, and regeneration context",
          "Keep all code self-contained and deterministic enough for safety scanning",
          "Return only parseable JSON, no markdown fences or commentary",
        ],
      }),
    },
  ];
}

async function evaluateGeneratedFiles(value: unknown): Promise<{
  files: GameSourceFiles | null;
  findings: string[];
}> {
  const normalized = normalizeRemoteFiles(value);
  if (!normalized.files) return normalized;

  const { files } = normalized;
  const joined = `${files.indexHtml}\n${files.gameJs}\n${files.styleCss}`;
  const findings: string[] = [];

  if (files.indexHtml.length < 420) {
    findings.push("indexHtml is too short to represent a complete game shell.");
  }
  if (files.gameJs.length < 1800) {
    findings.push("gameJs is too short for a full original playable game.");
  }
  if (files.styleCss.length < 500) {
    findings.push(
      "styleCss is too short for a responsive, polished game layout.",
    );
  }
  if (!/(?:score|points|得分|分数)/i.test(joined)) {
    findings.push("Generated game must expose score or points in code/UI.");
  }
  if (
    !/(?:lives|health|timer|time|win|lose|victory|gameOver|restart|生命|时间|胜利|失败|重开)/i.test(
      joined,
    )
  ) {
    findings.push(
      "Generated game must include end-state, timer/lives, or restart mechanics.",
    );
  }
  if (
    !/(?:keydown|keyup|pointerdown|pointermove|touchstart|mousedown|click)/i.test(
      files.gameJs,
    )
  ) {
    findings.push(
      "gameJs must wire keyboard, pointer, touch, or click controls.",
    );
  }
  if (!/(?:requestAnimationFrame|setInterval)/i.test(files.gameJs)) {
    findings.push("gameJs must include a real-time or turn-based update loop.");
  }

  const safety = await runSafetyReviewAgent(files);
  if (!safety.passed) {
    findings.push(...safety.findings.slice(0, 8));
  }

  return { files: findings.length > 0 ? null : files, findings };
}

export async function runCodeGenAgent(
  input: CodeGenAgentInput,
): Promise<CodeGenAgentResult> {
  if (shouldUseLocalFallback()) {
    return {
      ...generateGameFiles(input.design, input.intent),
      source: "local-demo-fallback",
      repairAttempts: 0,
      qualityFindings: [],
    };
  }

  const sources: CodeGenSource[] = [
    "remote-model",
    "remote-repair-1",
    "remote-repair-2",
  ];
  let repairFindings: string[] = [];

  for (let attempt = 0; attempt < sources.length; attempt += 1) {
    const remote = await callOpenAICompatibleJson<GameSourceFiles>(
      buildMessages(input, repairFindings),
    );
    const evaluation = await evaluateGeneratedFiles(remote);
    if (evaluation.files) {
      return {
        ...evaluation.files,
        source: sources[attempt]!,
        repairAttempts: attempt,
        qualityFindings: [],
      };
    }
    repairFindings = evaluation.findings.length
      ? evaluation.findings
      : ["Model did not return valid generated game files."];
  }

  throw new Error(
    `真实模型生成的游戏源码未通过质量门槛: ${repairFindings.slice(0, 6).join("; ")}`,
  );
}
