import { Prisma, db } from "@ai-arcade/db";
import { createJobSchema } from "@ai-arcade/shared/schemas";
import { fail, ok, parseError, validationFailureFor } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";
import { getGenerationQueue } from "@/lib/queue";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED", "Please log in to view jobs.", 401);

  const jobs = await db.generationJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return ok({ jobs });
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return fail(
        "UNAUTHORIZED",
        "Please log in before creating a generation job.",
        401,
      );

    const body = createJobSchema.parse(await request.json());
    const assets = body.assetIds.length
      ? await db.asset.findMany({
          where: {
            id: { in: body.assetIds },
            userId: user.id,
          },
        })
      : [];

    if (assets.length !== body.assetIds.length) {
      return fail(
        "ASSET_NOT_FOUND",
        "One or more selected assets do not exist or are not yours.",
        404,
      );
    }

    const job = await db.generationJob.create({
      data: {
        userId: user.id,
        prompt: body.prompt,
        inputAssets: assets.map((asset) => ({
          id: asset.id,
          originalName: asset.originalName,
          mimeType: asset.mimeType,
          size: asset.size,
          publicUrl: asset.publicUrl,
        })) as Prisma.InputJsonValue,
        status: "pending",
        currentStep: "queued",
        progress: 0,
      },
    });

    if (assets.length > 0) {
      await db.asset.updateMany({
        where: { id: { in: assets.map((asset) => asset.id) }, userId: user.id },
        data: { jobId: job.id },
      });
    }

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
      assetIds: {
        code: "ASSET_REQUIRED",
        message:
          "Please upload at least one asset before creating a generation job.",
      },
    });
    if (validation) return fail(validation.code, validation.message, 400);

    return fail("CREATE_JOB_FAILED", parseError(error), 400);
  }
}
