import { db } from "@ai-arcade/db";
import { fail, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED", "Please log in to view this job.", 401);

  const { jobId } = await context.params;
  const job = await db.generationJob.findFirst({
    where: {
      id: jobId,
      userId: user.id
    }
  });

  if (!job) return fail("JOB_NOT_FOUND", "Generation job not found.", 404);

  const game = job.gameId
    ? await db.game.findUnique({
        where: { id: job.gameId },
        include: { currentVersion: true }
      })
    : null;

  return ok({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    errorMessage: job.errorMessage,
    gameId: job.gameId,
    manifestUrl: game?.currentVersion?.manifestUrl ?? null,
    artifactBaseUrl: game?.currentVersion?.artifactBaseUrl ?? null,
    costEstimated: job.costEstimated,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt
  });
}
