import { Readable } from "node:stream";
import Credential from "@alicloud/credentials";
import DocMindClient, {
  GetDocParserResultRequest,
  QueryDocParserStatusRequest,
  SubmitDocParserJobAdvanceRequest,
} from "@alicloud/docmind-api20220711";
import { RuntimeOptions } from "@alicloud/tea-util";

type PlainRecord = Record<string, unknown>;

export type DocMindParseResult = {
  taskId: string;
  markdown: string;
  raw: PlainRecord;
};

function hasDocMindConfig(): boolean {
  if ((process.env.DOCMIND_ENABLED ?? "true") === "false") return false;
  const accessKeyId =
    process.env.DOCMIND_ACCESS_KEY_ID ||
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  const accessKeySecret =
    process.env.DOCMIND_ACCESS_KEY_SECRET ||
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  return Boolean(accessKeyId && accessKeySecret);
}

function toPlain(value: unknown): PlainRecord {
  if (!value || typeof value !== "object") return {};
  const maybeMappable = value as { toMap?: () => unknown };
  if (typeof maybeMappable.toMap === "function") {
    const mapped = maybeMappable.toMap();
    return mapped && typeof mapped === "object" ? (mapped as PlainRecord) : {};
  }
  return JSON.parse(JSON.stringify(value)) as PlainRecord;
}

function collectMarkdownFromLayouts(layouts: unknown): string {
  if (!Array.isArray(layouts)) return "";
  return layouts
    .map((layout) => {
      if (!layout || typeof layout !== "object") return "";
      const record = layout as Record<string, unknown>;
      if (typeof record.markdownContent === "string")
        return record.markdownContent;
      if (typeof record.text === "string") return record.text;
      if (typeof record.llmResult === "string") return record.llmResult;
      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createDocMindClient() {
  const credentialClient = new Credential();
  const credential = credentialClient.credential as {
    accessKeyId?: string;
    accessKeySecret?: string;
  };
  const accessKeyId =
    process.env.DOCMIND_ACCESS_KEY_ID ??
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID ??
    credential.accessKeyId;
  const accessKeySecret =
    process.env.DOCMIND_ACCESS_KEY_SECRET ??
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET ??
    credential.accessKeySecret;

  if (!accessKeyId || !accessKeySecret) return null;

  const config = {
    endpoint:
      process.env.DOCMIND_ENDPOINT ?? "docmind-api.cn-hangzhou.aliyuncs.com",
    accessKeyId,
    accessKeySecret,
    type: "access_key",
    regionId: process.env.DOCMIND_REGION_ID ?? "cn-hangzhou",
  } as unknown as ConstructorParameters<typeof DocMindClient>[0];

  return new DocMindClient(config);
}

export async function parseWithDocMind(params: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<DocMindParseResult | null> {
  if (!hasDocMindConfig()) return null;
  const client = createDocMindClient();
  if (!client) return null;

  const extension = params.fileName.includes(".")
    ? params.fileName.split(".").pop()
    : undefined;
  const runtime = new RuntimeOptions({
    connectTimeout: Number(process.env.DOCMIND_CONNECT_TIMEOUT_MS ?? 10000),
    readTimeout: Number(process.env.DOCMIND_READ_TIMEOUT_MS ?? 30000),
  });

  const submitRequest = new SubmitDocParserJobAdvanceRequest({
    fileUrlObject: Readable.from(params.buffer),
    fileName: params.fileName,
    fileNameExtension: extension,
    llmEnhancement: (process.env.DOCMIND_LLM_ENHANCEMENT ?? "true") !== "false",
    enhancementMode: process.env.DOCMIND_ENHANCEMENT_MODE ?? "VLM",
    outputFormat: ["markdown"],
    option:
      params.mimeType.startsWith("video/") ||
      params.mimeType.startsWith("audio/")
        ? "advance"
        : "base",
    multimediaParameters:
      params.mimeType.startsWith("video/") ||
      params.mimeType.startsWith("audio/")
        ? {
            vlParsePrompt:
              process.env.DOCMIND_VIDEO_PROMPT ??
              "请忠实概括视频关键画面、字幕、人物和与游戏创意相关的视觉元素，输出简洁中文描述。",
          }
        : undefined,
  });

  const submitResponse = await client.submitDocParserJobAdvance(
    submitRequest,
    runtime,
  );
  const taskId = String(
    (submitResponse.body?.data as { id?: string } | undefined)?.id ?? "",
  );
  if (!taskId) throw new Error("DocMind did not return a parser task id.");

  const maxAttempts = Number(process.env.DOCMIND_POLL_ATTEMPTS ?? 18);
  const pollMs = Number(process.env.DOCMIND_POLL_INTERVAL_MS ?? 2000);
  let lastStatus = "";
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const statusResponse = await client.queryDocParserStatusWithOptions(
      new QueryDocParserStatusRequest({ id: taskId }),
      runtime,
    );
    const statusData = toPlain(statusResponse.body?.data);
    lastStatus = String(
      statusData.Status ?? statusData.status ?? "",
    ).toLowerCase();
    if (lastStatus === "success") break;
    if (lastStatus === "failed")
      throw new Error(`DocMind parser task failed: ${taskId}`);
    await sleep(pollMs);
  }

  if (lastStatus !== "success")
    throw new Error(`DocMind parser task timed out: ${taskId}`);

  const resultChunks: PlainRecord[] = [];
  let layoutNum = 0;
  const layoutStepSize = Number(process.env.DOCMIND_LAYOUT_STEP_SIZE ?? 20);
  while (layoutNum < Number(process.env.DOCMIND_LAYOUT_LIMIT ?? 200)) {
    const resultResponse = await client.getDocParserResultWithOptions(
      new GetDocParserResultRequest({
        id: taskId,
        layoutNum,
        layoutStepSize,
      }),
      runtime,
    );
    const resultData = toPlain(resultResponse.body?.data);
    const layouts = Array.isArray(resultData.layouts) ? resultData.layouts : [];
    if (layouts.length === 0) break;
    resultChunks.push(resultData);
    layoutNum += layouts.length;
    if (layouts.length < layoutStepSize) break;
  }

  const markdown = resultChunks
    .map((chunk) => collectMarkdownFromLayouts(chunk.layouts))
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return {
    taskId,
    markdown,
    raw: {
      chunks: resultChunks.slice(0, 3),
      chunkCount: resultChunks.length,
    },
  };
}
