import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";

export type StorageConfig = {
  endpoint: string;
  publicEndpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  forcePathStyle: boolean;
  assetsBucket: string;
  artifactsBucket: string;
};

export type PutObjectInput = {
  bucket: string;
  key: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
};

export function getStorageConfig(): StorageConfig {
  return {
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    publicEndpoint: process.env.S3_PUBLIC_ENDPOINT ?? "http://localhost:9000",
    accessKeyId: process.env.S3_ACCESS_KEY ?? "minioadmin",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "minioadmin",
    region: process.env.S3_REGION ?? "us-east-1",
    forcePathStyle: (process.env.S3_FORCE_PATH_STYLE ?? "true") === "true",
    assetsBucket: process.env.S3_ASSETS_BUCKET ?? "game-assets",
    artifactsBucket: process.env.S3_ARTIFACTS_BUCKET ?? "game-artifacts"
  };
}

export function createS3Client(config = getStorageConfig()): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  });
}

export function sha256(input: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function safeFileName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return base || "upload.bin";
}

export function publicObjectUrl(bucket: string, key: string, config = getStorageConfig()): string {
  const endpoint = config.publicEndpoint.replace(/\/+$/g, "");
  return `${endpoint}/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function publicPrefixUrl(bucket: string, prefix: string, config = getStorageConfig()): string {
  const clean = prefix.replace(/^\/+|\/+$/g, "");
  return `${config.publicEndpoint.replace(/\/+$/g, "")}/${bucket}/${clean}`;
}

export async function ensureBucket(bucket: string, client = createS3Client()): Promise<void> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function ensureCoreBuckets(config = getStorageConfig()): Promise<void> {
  const client = createS3Client(config);
  await ensureBucket(config.assetsBucket, client);
  await ensureBucket(config.artifactsBucket, client);
}

export async function putObject(input: PutObjectInput, client = createS3Client()): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType
    })
  );
  return publicObjectUrl(input.bucket, input.key);
}

export function contentTypeForPath(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}
