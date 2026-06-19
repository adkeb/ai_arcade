import { Prisma, db } from "@ai-arcade/db";
import { ensureCoreBuckets, putObject } from "@ai-arcade/storage/minio";
import { objectKeyForArtifact } from "@ai-arcade/storage/artifact-protocol";
import type { PackagedArtifact, PublishedArtifact } from "../types";

export async function runPublishAgent(params: {
  userId: string;
  jobId: string | null;
  artifact: PackagedArtifact;
  status?: "draft" | "published";
}): Promise<PublishedArtifact> {
  await ensureCoreBuckets();

  for (const file of params.artifact.files) {
    await putObject({
      bucket: params.artifact.bucket,
      key: objectKeyForArtifact(
        params.artifact.gameId,
        params.artifact.version,
        file.path,
      ),
      body: file.body,
      contentType: file.contentType,
    });
  }

  const result = await db.$transaction(async (tx) => {
    const existingGame = await tx.game.findUnique({
      where: { id: params.artifact.gameId },
      select: {
        id: true,
        authorId: true,
        status: true,
        publishedAt: true,
      },
    });

    if (existingGame && existingGame.authorId !== params.userId) {
      throw new Error("Only the author can publish a new version.");
    }

    const game =
      existingGame ??
      (await tx.game.create({
        data: {
          id: params.artifact.gameId,
          authorId: params.userId,
          title: params.artifact.title,
          description: params.artifact.description,
          coverUrl: params.artifact.coverUrl,
          tags: params.artifact.tags,
          status: params.status ?? "draft",
          publishedAt: params.status === "published" ? new Date() : null,
        },
      }));

    const version = await tx.gameVersion.create({
      data: {
        gameId: game.id,
        versionNumber: params.artifact.version,
        jobId: params.jobId,
        artifactBaseUrl: params.artifact.artifactBaseUrl,
        manifestUrl: params.artifact.manifestUrl,
        entryFile: "index.html",
        storageBucket: params.artifact.bucket,
        storagePrefix: params.artifact.prefix,
        manifestJson: params.artifact
          .manifest as unknown as Prisma.InputJsonValue,
        buildStatus: "succeeded",
      },
    });

    await tx.game.update({
      where: { id: game.id },
      data: {
        title: params.artifact.title,
        description: params.artifact.description,
        coverUrl: params.artifact.coverUrl,
        tags: params.artifact.tags,
        currentVersionId: version.id,
      },
    });

    if (params.jobId) {
      await tx.generationJob.update({
        where: { id: params.jobId },
        data: {
          gameId: game.id,
          status: "succeeded",
          currentStep: "PublishAgent",
          progress: 100,
          finishedAt: new Date(),
        },
      });
    }

    return { gameId: game.id, versionId: version.id };
  });

  return {
    gameId: result.gameId,
    versionId: result.versionId,
    manifestUrl: params.artifact.manifestUrl,
    artifactBaseUrl: params.artifact.artifactBaseUrl,
  };
}
