import { randomUUID } from "node:crypto";
import { Prisma, db } from "@ai-arcade/db";
import {
  ensureCoreBuckets,
  getStorageConfig,
  putObject,
  safeFileName,
  sha256,
} from "@ai-arcade/storage/minio";
import { analyzeUploadedAsset } from "@/lib/asset-analysis";
import { fail, ok, parseError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

const allowedExactTypes = new Set([
  "application/pdf",
  "application/json",
  "application/octet-stream",
  "text/plain",
  "text/markdown",
]);

function isAllowedFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    file.type.startsWith("video/") ||
    allowedExactTypes.has(file.type)
  );
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return fail(
        "UNAUTHORIZED",
        "Please log in before uploading assets.",
        401,
      );

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File))
      return fail("MISSING_FILE", "Upload field 'file' is required.", 400);
    if (!isAllowedFile(file))
      return fail(
        "UNSUPPORTED_FILE_TYPE",
        "Only images, videos, PDFs, JSON, and text files are accepted.",
        415,
      );

    const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 20) * 1024 * 1024;
    if (file.size > maxBytes)
      return fail(
        "FILE_TOO_LARGE",
        `File exceeds ${process.env.MAX_UPLOAD_MB ?? 20} MB.`,
        413,
      );

    await ensureCoreBuckets();
    const config = getStorageConfig();
    const assetId = randomUUID();
    const fileName = safeFileName(file.name);
    const objectKey = `uploads/${user.id}/${assetId}/${fileName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const analysis = await analyzeUploadedAsset({
      fileName: file.name,
      mimeType,
      buffer,
    });
    const publicUrl = await putObject({
      bucket: config.assetsBucket,
      key: objectKey,
      body: buffer,
      contentType: mimeType,
    });

    const asset = await db.asset.create({
      data: {
        id: assetId,
        userId: user.id,
        originalName: file.name,
        mimeType,
        size: file.size,
        bucket: config.assetsBucket,
        objectKey,
        publicUrl,
        sha256: sha256(buffer),
        analysis: analysis as Prisma.InputJsonValue,
      },
    });

    return ok({
      assetId: asset.id,
      objectKey: asset.objectKey,
      url: asset.publicUrl,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      size: asset.size,
      analysis,
    });
  } catch (error) {
    return fail("UPLOAD_FAILED", parseError(error), 400);
  }
}
