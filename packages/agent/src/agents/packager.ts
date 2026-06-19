import { randomUUID } from "node:crypto";
import {
  buildManifest,
  objectKeyForArtifact,
} from "@ai-arcade/storage/artifact-protocol";
import {
  contentTypeForPath,
  getStorageConfig,
  publicObjectUrl,
  publicPrefixUrl,
} from "@ai-arcade/storage/minio";
import { generateCoverSvg } from "../local-generator";
import type {
  GameDesignSpec,
  GameSourceFiles,
  PackagedArtifact,
} from "../types";

export async function runBuildPackagerAgent(params: {
  design: GameDesignSpec;
  files: GameSourceFiles;
  jobId: string | null;
  gameId?: string;
  version?: number;
}): Promise<PackagedArtifact> {
  const config = getStorageConfig();
  const gameId = params.gameId ?? randomUUID();
  const version = params.version ?? 1;
  const bucket = config.artifactsBucket;
  const prefix = `games/${gameId}/v${version}`;
  const coverSvg = generateCoverSvg(params.design);
  const sourceFiles = [
    { path: "index.html" as const, body: params.files.indexHtml },
    { path: "game.js" as const, body: params.files.gameJs },
    { path: "style.css" as const, body: params.files.styleCss },
  ];
  const manifest = buildManifest({
    config,
    bucket,
    gameId,
    version,
    title: params.design.title,
    description: params.design.description,
    jobId: params.jobId,
    fileBodies: sourceFiles,
    assetBodies: [{ path: "cover.svg", body: coverSvg }],
  });
  const manifestBody = JSON.stringify(manifest, null, 2);

  const files = [
    ...sourceFiles,
    { path: "cover.svg" as const, body: coverSvg },
    { path: "manifest.json" as const, body: manifestBody },
  ].map((file) => ({
    ...file,
    contentType: contentTypeForPath(file.path),
  }));

  return {
    gameId,
    version,
    title: params.design.title,
    description: params.design.description,
    tags: params.design.tags,
    coverUrl: publicObjectUrl(
      bucket,
      objectKeyForArtifact(gameId, version, "cover.svg"),
      config,
    ),
    bucket,
    prefix,
    artifactBaseUrl: publicPrefixUrl(bucket, prefix, config),
    manifestUrl: publicObjectUrl(
      bucket,
      objectKeyForArtifact(gameId, version, "manifest.json"),
      config,
    ),
    manifest,
    files,
  };
}
