import { inflateSync } from "node:zlib";
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

type ImageMetadata = Record<string, string | number | boolean | null>;

function hexColor(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((value) =>
      Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"),
    )
    .join("")}`;
}

function imageOrientation(width: number | null, height: number | null): string {
  if (!width || !height) return "unknown";
  if (width > height * 1.2) return "landscape";
  if (height > width * 1.2) return "portrait";
  return "square-ish";
}

function colorMood(red: number, green: number, blue: number): string {
  const brightness = 0.299 * red + 0.587 * green + 0.114 * blue;
  const warmth = red - blue;
  const lightness =
    brightness < 70 ? "dark" : brightness > 185 ? "bright" : "balanced";
  const temperature = warmth > 35 ? "warm" : warmth < -35 ? "cool" : "neutral";
  return `${lightness} ${temperature}`;
}

function paethPredictor(left: number, up: number, upperLeft: number): number {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance)
    return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

function undoPngFilter(
  filterType: number,
  row: Uint8Array<ArrayBufferLike>,
  previous: Uint8Array<ArrayBufferLike>,
  bytesPerPixel: number,
): Uint8Array<ArrayBufferLike> {
  const output = new Uint8Array(row.length);
  for (let index = 0; index < row.length; index += 1) {
    const left =
      index >= bytesPerPixel ? (output[index - bytesPerPixel] ?? 0) : 0;
    const up = previous[index] ?? 0;
    const upperLeft =
      index >= bytesPerPixel ? (previous[index - bytesPerPixel] ?? 0) : 0;
    const value = row[index] ?? 0;
    if (filterType === 0) output[index] = value;
    else if (filterType === 1) output[index] = (value + left) & 0xff;
    else if (filterType === 2) output[index] = (value + up) & 0xff;
    else if (filterType === 3)
      output[index] = (value + Math.floor((left + up) / 2)) & 0xff;
    else if (filterType === 4)
      output[index] = (value + paethPredictor(left, up, upperLeft)) & 0xff;
    else output[index] = value;
  }
  return output;
}

function pngColorAnalysis(buffer: Buffer): ImageMetadata {
  try {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const bitDepth = buffer.readUInt8(24);
    const colorType = buffer.readUInt8(25);
    const interlace = buffer.readUInt8(28);
    if (bitDepth !== 8 || interlace !== 0 || ![0, 2, 6].includes(colorType))
      return {};

    const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
    let offset = 8;
    const chunks: Buffer[] = [];
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.toString("ascii", offset + 4, offset + 8);
      const dataStart = offset + 8;
      const dataEnd = dataStart + length;
      if (dataEnd > buffer.length) break;
      if (type === "IDAT") chunks.push(buffer.subarray(dataStart, dataEnd));
      if (type === "IEND") break;
      offset = dataEnd + 4;
    }
    if (chunks.length === 0) return {};

    const inflated = inflateSync(Buffer.concat(chunks));
    const rowLength = width * bytesPerPixel;
    let cursor = 0;
    let previous: Uint8Array<ArrayBufferLike> = new Uint8Array(rowLength);
    const counts = new Map<string, number>();
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let samples = 0;
    const sampleModulo = Math.max(1, Math.floor((width * height) / 4096));

    for (
      let y = 0;
      y < height && cursor + 1 + rowLength <= inflated.length;
      y += 1
    ) {
      const filterType = inflated[cursor] ?? 0;
      const row = inflated.subarray(cursor + 1, cursor + 1 + rowLength);
      const unfiltered = undoPngFilter(
        filterType,
        row,
        previous,
        bytesPerPixel,
      );
      previous = unfiltered;
      cursor += 1 + rowLength;

      for (let x = 0; x < width; x += 1) {
        const pixelIndex = y * width + x;
        if (pixelIndex % sampleModulo !== 0) continue;
        const byteIndex = x * bytesPerPixel;
        const red =
          colorType === 0
            ? (unfiltered[byteIndex] ?? 0)
            : (unfiltered[byteIndex] ?? 0);
        const green = colorType === 0 ? red : (unfiltered[byteIndex + 1] ?? 0);
        const blue = colorType === 0 ? red : (unfiltered[byteIndex + 2] ?? 0);
        redTotal += red;
        greenTotal += green;
        blueTotal += blue;
        samples += 1;
        const bucket = hexColor(
          Math.round(red / 32) * 32,
          Math.round(green / 32) * 32,
          Math.round(blue / 32) * 32,
        );
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      }
    }

    if (samples === 0) return {};
    const averageRed = Math.round(redTotal / samples);
    const averageGreen = Math.round(greenTotal / samples);
    const averageBlue = Math.round(blueTotal / samples);
    const dominantColors = Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([color]) => color)
      .join(", ");

    return {
      averageColor: hexColor(averageRed, averageGreen, averageBlue),
      dominantColors,
      brightness: Math.round(
        0.299 * averageRed + 0.587 * averageGreen + 0.114 * averageBlue,
      ),
      colorMood: colorMood(averageRed, averageGreen, averageBlue),
    };
  } catch {
    return {};
  }
}

function pngMetadata(buffer: Buffer): ImageMetadata | null {
  if (buffer.length < 29 || buffer.toString("ascii", 1, 4) !== "PNG")
    return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return {
    format: "png",
    width,
    height,
    orientation: imageOrientation(width, height),
    bitDepth: buffer.readUInt8(24),
    colorType: buffer.readUInt8(25),
    ...pngColorAnalysis(buffer),
  };
}

function jpegMetadata(buffer: Buffer): ImageMetadata | null {
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
        orientation: imageOrientation(
          buffer.readUInt16BE(offset + 7),
          buffer.readUInt16BE(offset + 5),
        ),
        precision: buffer.readUInt8(offset + 4),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function gifMetadata(buffer: Buffer): ImageMetadata | null {
  const signature = buffer.toString("ascii", 0, 6);
  if (buffer.length < 10 || (signature !== "GIF87a" && signature !== "GIF89a"))
    return null;
  const packed = buffer.readUInt8(10);
  const hasGlobalColorTable = (packed & 0x80) !== 0;
  const colorCount = hasGlobalColorTable ? 2 ** ((packed & 0x07) + 1) : 0;
  const palette: string[] = [];
  if (hasGlobalColorTable && buffer.length >= 13 + colorCount * 3) {
    for (let index = 0; index < Math.min(colorCount, 5); index += 1) {
      const offset = 13 + index * 3;
      palette.push(
        hexColor(
          buffer[offset] ?? 0,
          buffer[offset + 1] ?? 0,
          buffer[offset + 2] ?? 0,
        ),
      );
    }
  }
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  return {
    format: "gif",
    width,
    height,
    orientation: imageOrientation(width, height),
    paletteColors: palette.join(", ") || null,
  };
}

function webpMetadata(buffer: Buffer): ImageMetadata | null {
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
      orientation: imageOrientation(
        1 + buffer.readUIntLE(24, 3),
        1 + buffer.readUIntLE(27, 3),
      ),
    };
  }
  return { format: "webp", width: null, height: null, orientation: null };
}

function analyzeImage(mimeType: string, buffer: Buffer): AssetAnalysis {
  const metadata =
    pngMetadata(buffer) ??
    jpegMetadata(buffer) ??
    gifMetadata(buffer) ??
    webpMetadata(buffer);
  const visualDetails =
    metadata && metadata.width && metadata.height
      ? [
          `${metadata.format} ${metadata.width}x${metadata.height}`,
          metadata.orientation,
          metadata.dominantColors
            ? `dominant colors ${metadata.dominantColors}`
            : "",
          metadata.colorMood ? `${metadata.colorMood} palette` : "",
          metadata.paletteColors ? `palette ${metadata.paletteColors}` : "",
        ]
          .filter(Boolean)
          .join(", ")
      : "";
  return {
    kind: "image",
    summary:
      metadata && metadata.width && metadata.height
        ? `Image asset parsed as ${visualDetails}.`
        : "Image asset detected; dimensions were not extractable from the header.",
    textExcerpt: visualDetails || undefined,
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

function mp4Brands(buffer: Buffer): string {
  if (buffer.length < 16 || buffer.toString("ascii", 4, 8) !== "ftyp")
    return "";
  const major = buffer.toString("ascii", 8, 12).replace(/\0/g, "").trim();
  const compatible: string[] = [];
  for (
    let offset = 16;
    offset + 4 <= Math.min(buffer.length, 64);
    offset += 4
  ) {
    const brand = buffer
      .toString("ascii", offset, offset + 4)
      .replace(/\0/g, "")
      .trim();
    if (brand && /^[\w -]+$/.test(brand)) compatible.push(brand);
  }
  return [major, ...compatible.filter((brand) => brand !== major)]
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");
}

function analyzeVideo(mimeType: string, buffer: Buffer): AssetAnalysis {
  const isMp4 = buffer.toString("ascii", 4, 8) === "ftyp";
  const duration = isMp4 ? readMp4Duration(buffer) : null;
  const brands = isMp4 ? mp4Brands(buffer) : "";
  const textExcerpt = [
    isMp4 ? "MP4 video container" : "video asset",
    duration ? `duration about ${duration}s` : "",
    brands ? `brands ${brands}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return {
    kind: "video",
    summary: duration
      ? `Video asset parsed as MP4, duration about ${duration}s.`
      : "Video asset detected with basic container metadata.",
    textExcerpt,
    metadata: {
      mimeType,
      container: isMp4 ? "mp4" : "unknown",
      durationSeconds: duration,
      brands: brands || null,
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
