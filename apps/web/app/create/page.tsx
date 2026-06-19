import { redirect } from "next/navigation";
import type { AssetAnalysis } from "@ai-arcade/shared";
import { db } from "@ai-arcade/db";
import { CreateClient } from "@/components/CreateClient";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

function normalizeInputAssets(inputAssets: unknown) {
  if (!Array.isArray(inputAssets)) return [];
  return inputAssets
    .map((asset) => {
      if (!asset || typeof asset !== "object") return null;
      const record = asset as Record<string, unknown>;
      const id = String(record.id ?? "");
      if (!id) return null;
      return {
        id,
        originalName: String(record.originalName ?? "asset"),
        mimeType: String(record.mimeType ?? "application/octet-stream"),
        size: Number(record.size ?? 0),
        publicUrl: String(record.publicUrl ?? ""),
        analysis: (record.analysis as AssetAnalysis | undefined) ?? null,
      };
    })
    .filter(
      (
        asset,
      ): asset is {
        id: string;
        originalName: string;
        mimeType: string;
        size: number;
        publicUrl: string;
        analysis: AssetAnalysis | null;
      } => Boolean(asset),
    );
}

export default async function CreatePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const jobs = await db.generationJob.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const initialJobs = jobs.map((job) => ({
    id: job.id,
    prompt: job.prompt,
    status: job.status,
    progress: job.progress,
    currentStep: job.currentStep,
    errorMessage: job.errorMessage,
    gameId: job.gameId,
    costEstimated: job.costEstimated,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    assets: normalizeInputAssets(job.inputAssets),
  }));

  return <CreateClient initialJobs={initialJobs} />;
}
