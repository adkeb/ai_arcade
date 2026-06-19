export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProviderConfig = {
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
  enableThinking: boolean;
  useResponseFormat: boolean;
};

export const MODEL_REQUIRED_ERROR_MESSAGE =
  "未配置真实模型，不能执行 AI 原创生成";

function getProviderConfig(): ProviderConfig {
  const apiKey = process.env.OPENAI_API_KEY || process.env.DASHSCOPE_API_KEY;
  const baseUrl = (
    process.env.OPENAI_BASE_URL ??
    process.env.DASHSCOPE_BASE_URL ??
    "https://llm-fqmv3nbrmalei7ti.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
  ).replace(/\/+$/g, "");

  return {
    apiKey,
    baseUrl,
    model:
      process.env.OPENAI_MODEL ?? process.env.DASHSCOPE_MODEL ?? "qwen3.7-plus",
    enableThinking:
      (process.env.OPENAI_ENABLE_THINKING ??
        process.env.DASHSCOPE_ENABLE_THINKING ??
        "true") === "true",
    useResponseFormat:
      (process.env.OPENAI_JSON_RESPONSE_FORMAT ?? "true") !== "false",
  };
}

export function shouldUseLocalFallback(): boolean {
  return process.env.USE_LOCAL_AGENT_FALLBACK === "true";
}

export function hasModelProviderConfig(): boolean {
  return Boolean(getProviderConfig().apiKey);
}

export async function callOpenAICompatibleJson<T>(
  messages: ChatMessage[],
): Promise<T | null> {
  const config = getProviderConfig();
  if (shouldUseLocalFallback()) return null;
  if (!config.apiKey) {
    throw new Error(
      `${MODEL_REQUIRED_ERROR_MESSAGE}。请配置 OPENAI_API_KEY 或 DASHSCOPE_API_KEY；仅 demo/test 可设置 USE_LOCAL_AGENT_FALLBACK=true。`,
    );
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.4,
      ...(config.useResponseFormat
        ? { response_format: { type: "json_object" } }
        : {}),
      ...(config.enableThinking ? { enable_thinking: true } : {}),
    }),
  });

  if (!response.ok) return null;
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) return null;

  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
