import type { AssetAnalysis } from "@ai-arcade/shared";
import { parseWithDocMind } from "@/lib/docmind";

const TEXT_LIMIT = 4000;

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, TEXT_LIMIT);
}

function decodeUtf8(buffer: Buffer): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(buffer);
}

function analyzeText(mimeType: string, buffer: Buffer): AssetAnalysis {
  const text = cleanText(decodeUtf8(buffer));
  return {
    kind: "text",
    summary: text
      ? `Text asset with ${text.length} readable characters.`
      : "Text asset with no readable characters.",
    textExcerpt: text || undefined,
    metadata: {
      mimeType,
      characters: text.length,
      lines: text ? text.split(/[.!?\n。！？]/).filter(Boolean).length : 0,
    },
  };
}

function analyzeJson(mimeType: string, buffer: Buffer): AssetAnalysis {
  const source = decodeUtf8(buffer);
  try {
    const parsed = JSON.parse(source) as unknown;
    const keys =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? Object.keys(parsed).slice(0, 20)
        : [];
    const text = cleanText(JSON.stringify(parsed).slice(0, TEXT_LIMIT));
    return {
      kind: "json",
      summary: keys.length
        ? `JSON asset with top-level keys: ${keys.join(", ")}.`
        : "JSON asset parsed successfully.",
      textExcerpt: text,
      metadata: {
        mimeType,
        topLevelType: Array.isArray(parsed) ? "array" : typeof parsed,
        topLevelKeyCount: keys.length,
      },
    };
  } catch {
    const fallback = analyzeText(mimeType, buffer);
    return {
      ...fallback,
      kind: "json",
      summary:
        "JSON asset could not be parsed; using readable text excerpt instead.",
      warnings: ["Invalid JSON payload."],
    };
  }
}

function unescapePdfString(value: string): string {
  return value
    .slice(1, -1)
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\[0-7]{1,3}/g, " ");
}

function analyzePdf(mimeType: string, buffer: Buffer): AssetAnalysis {
  const raw = buffer.toString("latin1");
  const strings = Array.from(raw.matchAll(/\((?:\\.|[^\\)]){2,}\)/g))
    .map((match) => unescapePdfString(match[0]))
    .filter((value) => /[A-Za-z0-9\u4e00-\u9fff]/.test(value));
  const text = cleanText(strings.join(" "));
  const pageCount = Math.max(0, (raw.match(/\/Type\s*\/Page\b/g) ?? []).length);

  return {
    kind: "pdf",
    summary: text
      ? `PDF asset with ${pageCount || "unknown"} pages and extracted text excerpt.`
      : `PDF asset with ${pageCount || "unknown"} pages; text appears compressed or image-based.`,
    textExcerpt: text || undefined,
    metadata: {
      mimeType,
      pages: pageCount || null,
      extractedCharacters: text.length,
    },
    warnings: text
      ? undefined
      : ["No plain embedded PDF text was extractable."],
  };
}

function pngMetadata(buffer: Buffer) {
  if (buffer.length < 29 || buffer.toString("ascii", 1, 4) !== "PNG")
    return null;
  return {
    format: "png",
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    bitDepth: buffer.readUInt8(24),
    colorType: buffer.readUInt8(25),
  };
}

function jpegMetadata(buffer: Buffer) {
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1] ?? 0;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) break;
    if (
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb)
    ) {
      return {
        format: "jpeg",
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
        precision: buffer.readUInt8(offset + 4),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function gifMetadata(buffer: Buffer) {
  const signature = buffer.toString("ascii", 0, 6);
  if (buffer.length < 10 || (signature !== "GIF87a" && signature !== "GIF89a"))
    return null;
  return {
    format: "gif",
    width: buffer.readUInt16LE(6),
    height: buffer.readUInt16LE(8),
  };
}

function webpMetadata(buffer: Buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    return null;
  }
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X" && buffer.length >= 30) {
    return {
      format: "webp",
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }
  return { format: "webp", width: null, height: null };
}

function analyzeImage(mimeType: string, buffer: Buffer): AssetAnalysis {
  const metadata =
    pngMetadata(buffer) ??
    jpegMetadata(buffer) ??
    gifMetadata(buffer) ??
    webpMetadata(buffer);
  return {
    kind: "image",
    summary:
      metadata && metadata.width && metadata.height
        ? `Image asset parsed as ${metadata.format}, ${metadata.width}x${metadata.height}.`
        : "Image asset detected; dimensions were not extractable from the header.",
    metadata: {
      mimeType,
      ...(metadata ?? { format: mimeType.split("/")[1] ?? "image" }),
    },
    warnings: metadata
      ? undefined
      : ["Unsupported image header for dimension extraction."],
  };
}

function readMp4Duration(buffer: Buffer) {
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    if (size < 8) break;
    if (type === "moov") {
      let inner = offset + 8;
      const end = Math.min(offset + size, buffer.length);
      while (inner + 24 <= end) {
        const atomSize = buffer.readUInt32BE(inner);
        const atomType = buffer.toString("ascii", inner + 4, inner + 8);
        if (atomSize < 8) break;
        if (atomType === "mvhd") {
          const version = buffer.readUInt8(inner + 8);
          const timescaleOffset = version === 1 ? inner + 28 : inner + 20;
          const durationOffset = version === 1 ? inner + 32 : inner + 24;
          if (durationOffset + 4 <= buffer.length) {
            const timescale = buffer.readUInt32BE(timescaleOffset);
            const duration = buffer.readUInt32BE(durationOffset);
            return timescale ? Number((duration / timescale).toFixed(2)) : null;
          }
        }
        inner += atomSize;
      }
    }
    offset += size;
  }
  return null;
}

function analyzeVideo(mimeType: string, buffer: Buffer): AssetAnalysis {
  const isMp4 = buffer.toString("ascii", 4, 8) === "ftyp";
  const duration = isMp4 ? readMp4Duration(buffer) : null;
  return {
    kind: "video",
    summary: duration
      ? `Video asset parsed as MP4, duration about ${duration}s.`
      : "Video asset detected with basic container metadata.",
    metadata: {
      mimeType,
      container: isMp4 ? "mp4" : "unknown",
      durationSeconds: duration,
    },
    warnings: duration
      ? undefined
      : ["Detailed video track analysis is not available in the local parser."],
  };
}

function analyzeLocally(params: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): AssetAnalysis {
  const { fileName, mimeType, buffer } = params;
  const lowerName = fileName.toLowerCase();

  if (mimeType === "application/json" || lowerName.endsWith(".json"))
    return analyzeJson(mimeType, buffer);
  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf"))
    return analyzePdf(mimeType, buffer);
  if (mimeType.startsWith("image/")) return analyzeImage(mimeType, buffer);
  if (mimeType.startsWith("video/")) return analyzeVideo(mimeType, buffer);
  if (
    mimeType.startsWith("text/") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".txt")
  )
    return analyzeText(mimeType, buffer);

  return {
    kind: "binary",
    summary: "Binary asset stored without readable local content extraction.",
    metadata: {
      mimeType,
      bytes: buffer.length,
    },
  };
}

export async function analyzeUploadedAsset(params: {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<AssetAnalysis> {
  const local = analyzeLocally(params);

  try {
    const docMind = await parseWithDocMind(params);
    if (!docMind) return local;

    const markdown = cleanText(docMind.markdown);
    return {
      kind: local.kind,
      summary: markdown
        ? `Aliyun DocMind parsed ${local.kind} asset and extracted ${markdown.length} markdown characters.`
        : `Aliyun DocMind parsed ${local.kind} asset and returned structured metadata.`,
      textExcerpt: markdown || local.textExcerpt,
      metadata: {
        ...local.metadata,
        parser: "aliyun-docmind",
        docMindTaskId: docMind.taskId,
        extractedMarkdownCharacters: markdown.length,
        rawChunkCount: Number(docMind.raw.chunkCount ?? 0),
      },
      warnings: markdown
        ? local.warnings
        : [...(local.warnings ?? []), "DocMind returned no markdown excerpt."],
    };
  } catch (error) {
    return {
      ...local,
      warnings: [
        ...(local.warnings ?? []),
        `DocMind unavailable, used local parser fallback: ${error instanceof Error ? error.message : "unknown error"}`,
      ],
    };
  }
}
