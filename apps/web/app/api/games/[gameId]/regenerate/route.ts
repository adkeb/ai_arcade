import { Prisma, db } from "@ai-arcade/db";
import { regenerateGameSchema } from "@ai-arcade/shared/schemas";
import { fail, ok, parseError, validationFailureFor } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { getGenerationQueue } from "@/lib/queue";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ gameId: string }>;
};

export async function POST(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return fail(
        "UNAUTHORIZED",
        "Please log in before regenerating a game.",
        401,
      );

    const { gameId } = await context.params;
    const body = regenerateGameSchema.parse(await request.json());
    const game = await db.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        authorId: true,
        title: true,
        description: true,
        tags: true,
        currentVersion: {
          select: {
            versionNumber: true,
            manifestUrl: true,
            artifactBaseUrl: true,
            storagePrefix: true,
          },
        },
      },
    });

    if (!game) return fail("GAME_NOT_FOUND", "Game not found.", 404);
    if (game.authorId !== user.id)
      return fail(
        "FORBIDDEN",
        "Only the author can regenerate this game.",
        403,
      );

    const contextPrompt = [
      `Existing game: ${game.title}`,
      `Current description: ${game.description}`,
      `Current tags: ${game.tags.join(", ") || "none"}`,
      game.currentVersion
        ? `Current version: v${game.currentVersion.versionNumber}, artifact ${game.currentVersion.storagePrefix}`
        : "Current version: none",
      `Author requested change: ${body.prompt}`,
    ].join("\n");
    const inputAssets = [
      {
        id: `game-context-${game.id}`,
        originalName: `${game.title} current version context`,
        mimeType: "application/vnd.ai-arcade.game-context+json",
        size: 0,
        publicUrl: game.currentVersion?.manifestUrl ?? "",
        analysis: {
          kind: "json",
          summary: `Existing AI Arcade game context for ${game.title}.`,
          textExcerpt: contextPrompt,
          metadata: {
            gameId: game.id,
            tags: game.tags.join(", "),
            currentVersion: game.currentVersion?.versionNumber ?? null,
            artifactBaseUrl: game.currentVersion?.artifactBaseUrl ?? null,
          },
        },
      },
    ];

    const job = await db.generationJob.create({
      data: {
        userId: user.id,
        gameId: game.id,
        prompt: contextPrompt,
        inputAssets: inputAssets as Prisma.InputJsonValue,
        status: "pending",
        currentStep: "queued",
        progress: 0,
      },
    });

    await getGenerationQueue().add(
      "generate-game",
      { jobId: job.id },
      {
        jobId: job.id,
        attempts: 2,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    return ok({
      jobId: job.id,
      status: job.status,
      currentStep: job.currentStep,
    });
  } catch (error) {
    const validation = validationFailureFor(error, {
      prompt: {
        code: "PROMPT_TOO_SHORT",
        message: "Prompt must be between 10 and 2000 characters.",
      },
    });
    if (validation) return fail(validation.code, validation.message, 400);
    return fail("REGENERATE_GAME_FAILED", parseError(error), 400);
  }
}
