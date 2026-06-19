import type { ArtifactFile, GameManifest } from "@ai-arcade/shared";
import { contentTypeForPath, publicObjectUrl, sha256, type StorageConfig } from "./minio";

export type ArtifactSourceFile = {
  path: "index.html" | "game.js" | "style.css" | "manifest.json" | "cover.svg";
  body: string;
  contentType?: string;
};

export type ArtifactPackage = {
  gameId: string;
  version: number;
  title: string;
  description: string;
  coverPath: "cover.svg";
  bucket: string;
  prefix: string;
  artifactBaseUrl: string;
  manifestUrl: string;
  manifest: GameManifest;
  files: ArtifactSourceFile[];
};

export function objectKeyForArtifact(gameId: string, version: number, path: string): string {
  return `games/${gameId}/v${version}/${path}`;
}

export function buildManifest(params: {
  config: StorageConfig;
  bucket: string;
  gameId: string;
  version: number;
  title: string;
  description: string;
  jobId: string | null;
  fileBodies: Array<{ path: "index.html" | "game.js" | "style.css"; body: string }>;
  assetBodies?: Array<{ path: "cover.svg"; body: string }>;
}): GameManifest {
  const toArtifactFile = (file: { path: string; body: string }): ArtifactFile => ({
    path: file.path,
    url: publicObjectUrl(params.bucket, objectKeyForArtifact(params.gameId, params.version, file.path), params.config),
    sha256: sha256(file.body),
    contentType: contentTypeForPath(file.path)
  });

  return {
    schemaVersion: "1.0",
    gameId: params.gameId,
    version: params.version,
    title: params.title,
    description: params.description,
    runtime: "iframe-html5-canvas",
    entry: "index.html",
    createdByJobId: params.jobId,
    files: params.fileBodies.map(toArtifactFile),
    assets: (params.assetBodies ?? []).map(toArtifactFile),
    permissions: {
      network: false,
      storage: false,
      parentMessaging: true
    }
  };
}
