import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import test from "node:test";
import { analyzeUploadedAsset } from "../../apps/web/lib/asset-analysis";

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  return Buffer.concat([
    length,
    Buffer.from(type, "ascii"),
    data,
    Buffer.alloc(4),
  ]);
}

function twoColorPng(): Buffer {
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const scanline = Buffer.from([0, 255, 0, 0, 0, 0, 255]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanline)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

test("local asset analysis extracts PNG dimensions and palette hints without DocMind", async () => {
  const previous = process.env.DOCMIND_ENABLED;
  process.env.DOCMIND_ENABLED = "false";

  try {
    const analysis = await analyzeUploadedAsset({
      fileName: "palette.png",
      mimeType: "image/png",
      buffer: twoColorPng(),
    });

    assert.equal(analysis.kind, "image");
    assert.match(analysis.summary, /png 2x1/);
    assert.match(analysis.textExcerpt ?? "", /dominant colors/);
    assert.equal(analysis.metadata.width, 2);
    assert.equal(analysis.metadata.height, 1);
    assert.equal(analysis.metadata.orientation, "landscape");
    assert.equal(typeof analysis.metadata.averageColor, "string");
    assert.equal(typeof analysis.metadata.dominantColors, "string");
  } finally {
    process.env.DOCMIND_ENABLED = previous;
  }
});

test("local asset analysis extracts PDF plain text and page count", async () => {
  const previous = process.env.DOCMIND_ENABLED;
  process.env.DOCMIND_ENABLED = "false";

  try {
    const pdf = Buffer.from(
      "%PDF-1.4\n1 0 obj << /Type /Page >> endobj\n2 0 obj << /Length 44 >> stream\nBT (Arcade Design Brief) Tj ET\nendstream\nendobj\n%%EOF",
      "latin1",
    );
    const analysis = await analyzeUploadedAsset({
      fileName: "brief.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });

    assert.equal(analysis.kind, "pdf");
    assert.equal(analysis.metadata.pages, 1);
    assert.match(analysis.textExcerpt ?? "", /Arcade Design Brief/);
  } finally {
    process.env.DOCMIND_ENABLED = previous;
  }
});
