import "dotenv/config";
import { callOpenAICompatibleJson } from "../packages/agent/src/model-provider";
import { parseWithDocMind } from "../apps/web/lib/docmind";
import { buildAuthorizationUrl, getOAuthConfig } from "../apps/web/lib/oauth";

type SmokeResult = {
  name: string;
  status: "passed" | "skipped";
  detail: string;
};

const results: SmokeResult[] = [];

function hasAny(...values: Array<string | undefined>): boolean {
  return values.some((value) => Boolean(value?.trim()));
}

async function smokeLlm() {
  if (
    !hasAny(process.env.OPENAI_API_KEY, process.env.DASHSCOPE_API_KEY) ||
    process.env.RUN_EXTERNAL_SMOKE === "false"
  ) {
    results.push({
      name: "llm-codegen-provider",
      status: "skipped",
      detail:
        "OPENAI_API_KEY/DASHSCOPE_API_KEY missing or RUN_EXTERNAL_SMOKE=false.",
    });
    return;
  }

  const previousFallback = process.env.USE_LOCAL_AGENT_FALLBACK;
  const previousThinking = process.env.OPENAI_ENABLE_THINKING;
  process.env.USE_LOCAL_AGENT_FALLBACK = "false";
  process.env.OPENAI_ENABLE_THINKING =
    process.env.OPENAI_ENABLE_THINKING ?? "false";
  const response = await callOpenAICompatibleJson<{ ok?: boolean }>([
    {
      role: "system",
      content: 'Return JSON only. The JSON shape is {"ok": true}.',
    },
    { role: "user", content: "Return exactly one small JSON object." },
  ]);
  process.env.USE_LOCAL_AGENT_FALLBACK = previousFallback;
  process.env.OPENAI_ENABLE_THINKING = previousThinking;

  if (!response?.ok)
    throw new Error("LLM provider did not return expected JSON.");
  results.push({
    name: "llm-codegen-provider",
    status: "passed",
    detail: "OpenAI-compatible JSON call returned a valid response.",
  });
}

async function smokeDocMind() {
  if (
    !hasAny(
      process.env.DOCMIND_ACCESS_KEY_ID,
      process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
    ) ||
    !hasAny(
      process.env.DOCMIND_ACCESS_KEY_SECRET,
      process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
    ) ||
    process.env.DOCMIND_ENABLED === "false" ||
    process.env.RUN_EXTERNAL_SMOKE === "false"
  ) {
    results.push({
      name: "aliyun-docmind",
      status: "skipped",
      detail:
        "DocMind access key/secret missing, DOCMIND_ENABLED=false, or RUN_EXTERNAL_SMOKE=false.",
    });
    return;
  }

  const result = await parseWithDocMind({
    fileName: "ai-arcade-smoke.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("AI Arcade external DocMind smoke test.", "utf8"),
  });
  if (!result?.taskId) throw new Error("DocMind did not return a task id.");
  results.push({
    name: "aliyun-docmind",
    status: "passed",
    detail: `DocMind task ${result.taskId} completed.`,
  });
}

function smokeOAuth(provider: "github" | "google") {
  const hasConfig =
    provider === "github"
      ? hasAny(process.env.GITHUB_CLIENT_ID) &&
        hasAny(process.env.GITHUB_CLIENT_SECRET)
      : hasAny(process.env.GOOGLE_CLIENT_ID) &&
        hasAny(process.env.GOOGLE_CLIENT_SECRET);
  if (!hasConfig) {
    results.push({
      name: `${provider}-oauth-config`,
      status: "skipped",
      detail: `${provider.toUpperCase()} OAuth client id/secret missing.`,
    });
    return;
  }

  const request = new Request(process.env.APP_URL ?? "http://localhost:3000");
  const config = getOAuthConfig(provider, request);
  const url = buildAuthorizationUrl(config, "smoke-state");
  if (url.searchParams.get("state") !== "smoke-state") {
    throw new Error(`${provider} OAuth URL did not preserve state.`);
  }
  results.push({
    name: `${provider}-oauth-config`,
    status: "passed",
    detail:
      "Provider authorization URL can be built; full OAuth exchange still requires an interactive browser account.",
  });
}

async function main() {
  await smokeLlm();
  await smokeDocMind();
  smokeOAuth("github");
  smokeOAuth("google");

  for (const result of results) {
    console.log(`[${result.status}] ${result.name}: ${result.detail}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
