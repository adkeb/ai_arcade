import { db } from "@ai-arcade/db";
import { fail, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED", "Please log in to view logs.", 401);

  const { jobId } = await context.params;
  const job = await db.generationJob.findFirst({
    where: { id: jobId, userId: user.id },
    select: { id: true }
  });
  if (!job) return fail("JOB_NOT_FOUND", "Generation job not found.", 404);

  const logs = await db.agentLog.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" }
  });

  return ok({ logs });
}
