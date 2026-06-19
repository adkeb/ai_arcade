import { Prisma, db } from "@ai-arcade/db";
import { runBuildPackagerAgent } from "./agents/packager";
import { runCodeGenAgent } from "./agents/code-gen";
import { runGameDesignAgent } from "./agents/game-design";
import { runIntentPlannerAgent } from "./agents/intent-planner";
import { runPublishAgent } from "./agents/publisher";
import { runSafetyReviewAgent } from "./agents/safety-review";
import type { AssetSummary, PublishedArtifact } from "./types";

function summarize(value: unknown): string {
  if (typeof value === "string") return value.slice(0, 700);
  if (value && typeof value === "object") {
    const compact = JSON.stringify(value, (_key, item) => {
      if (typeof item === "string" && item.length > 260) return `${item.slice(0, 260)}...`;
      return item;
    });
    return compact.slice(0, 900);
  }
  return String(value);
}

function rawForLog(value: unknown): Prisma.InputJsonValue | undefined {
  if (!value || typeof value !== "object") return undefined;
  const text = JSON.stringify(value, (_key, item) => {
    if (typeof item === "string" && item.length > 1200) return `${item.slice(0, 1200)}...`;
    return item;
  });
  return JSON.parse(text) as Prisma.InputJsonValue;
}

async function runLoggedStep<T>(params: {
  jobId: string;
  agentName: string;
  step: string;
  progress: number;
  inputSummary: string;
  execute: () => Promise<T>;
}): Promise<T> {
  await db.generationJob.update({
    where: { id: params.jobId },
    data: {
      status: "running",
      currentStep: params.agentName,
      progress: params.progress
    }
  });

  const log = await db.agentLog.create({
    data: {
      jobId: params.jobId,
      agentName: params.agentName,
      step: params.step,
      status: "running",
      inputSummary: params.inputSummary,
      startedAt: new Date()
    }
  });

  try {
    const result = await params.execute();
    await db.agentLog.update({
      where: { id: log.id },
      data: {
        status: "succeeded",
        outputSummary: summarize(result),
        rawJson: rawForLog(result),
        finishedAt: new Date()
      }
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown agent error";
    await db.agentLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        errorMessage: message,
        outputSummary: message,
        finishedAt: new Date()
      }
    });
    throw error;
  }
}

function readAssetsFromJob(job: Awaited<ReturnType<typeof loadJobContext>>): AssetSummary[] {
  const relationAssets = job.assets.map((asset) => ({
    id: asset.id,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    size: asset.size,
    publicUrl: asset.publicUrl
  }));
  if (relationAssets.length > 0) return relationAssets;

  const inputAssets = Array.isArray(job.inputAssets) ? job.inputAssets : [];
  return inputAssets
    .map((asset) => {
      if (!asset || typeof asset !== "object") return null;
      const record = asset as Record<string, unknown>;
      return {
        id: String(record.id ?? ""),
        originalName: String(record.originalName ?? "asset"),
        mimeType: String(record.mimeType ?? "application/octet-stream"),
        size: Number(record.size ?? 0),
        publicUrl: String(record.publicUrl ?? "")
      };
    })
    .filter((asset): asset is AssetSummary => Boolean(asset?.id));
}

function estimateGenerationCost(params: {
  prompt: string;
  assets: AssetSummary[];
  files: { indexHtml: string; gameJs: string; styleCss: string };
}): number {
  const promptTokens = Math.ceil(params.prompt.length / 4);
  const assetTokens = params.assets.reduce((total, asset) => total + Math.ceil(asset.size / 2048), 0);
  const outputTokens = Math.ceil((params.files.indexHtml.length + params.files.gameJs.length + params.files.styleCss.length) / 4);
  const orchestrationOverheadTokens = 1200;
  const estimatedUsd = (promptTokens + assetTokens + orchestrationOverheadTokens) * 0.0000006 + outputTokens * 0.0000024;
  return Number(Math.max(0.001, estimatedUsd).toFixed(4));
}

async function loadJobContext(jobId: string) {
  const job = await db.generationJob.findUnique({
    where: { id: jobId },
    include: {
      user: true,
      assets: true
    }
  });

  if (!job) throw new Error(`Generation job not found: ${jobId}`);
  return job;
}

export async function runGenerationJob(jobId: string): Promise<PublishedArtifact> {
  const startedAt = new Date();
  await db.generationJob.update({
    where: { id: jobId },
    data: {
      status: "running",
      currentStep: "createJobContext",
      progress: 3,
      startedAt,
      errorMessage: null
    }
  });

  try {
    const job = await loadJobContext(jobId);
    const assets = readAssetsFromJob(job);

    const intent = await runLoggedStep({
      jobId,
      agentName: "IntentPlannerAgent",
      step: "Parse gameplay intent, theme, controls, entities, and win/loss conditions",
      progress: 12,
      inputSummary: `Prompt: ${job.prompt.slice(0, 240)}; assets: ${assets.map((asset) => asset.originalName).join(", ") || "none"}`,
      execute: () => runIntentPlannerAgent(job.prompt, assets)
    });

    const design = await runLoggedStep({
      jobId,
      agentName: "GameDesignAgent",
      step: "Convert intent into a concrete game design specification",
      progress: 28,
      inputSummary: summarize(intent),
      execute: () => runGameDesignAgent(job.prompt, intent)
    });

    const files = await runLoggedStep({
      jobId,
      agentName: "CodeGenAgent",
      step: "Generate dependency-free HTML5 Canvas runtime files",
      progress: 48,
      inputSummary: `${design.title}: ${design.gameplayLoop}`,
      execute: () => runCodeGenAgent(design, intent)
    });

    const safety = await runLoggedStep({
      jobId,
      agentName: "SafetyReviewAgent",
      step: "Scan generated code for blocked browser capabilities",
      progress: 64,
      inputSummary: `Files: index.html=${files.indexHtml.length}, game.js=${files.gameJs.length}, style.css=${files.styleCss.length}`,
      execute: () => runSafetyReviewAgent(files)
    });

    if (!safety.passed) {
      throw new Error(`Safety review failed: ${safety.findings.join("; ")}`);
    }

    const artifact = await runLoggedStep({
      jobId,
      agentName: "BuildPackagerAgent",
      step: "Hash files and produce manifest.json artifact protocol",
      progress: 78,
      inputSummary: `Safe files for ${design.title}`,
      execute: () =>
        runBuildPackagerAgent({
          design,
          files: safety.files,
          jobId
        })
    });

    const published = await runLoggedStep({
      jobId,
      agentName: "PublishAgent",
      step: "Upload artifact files to MinIO and persist Game/GameVersion records",
      progress: 92,
      inputSummary: `Artifact prefix ${artifact.prefix}`,
      execute: () =>
        runPublishAgent({
          userId: job.userId,
          jobId,
          artifact,
          status: "draft"
        })
    });

    const costEstimated = estimateGenerationCost({
      prompt: job.prompt,
      assets,
      files: safety.files
    });

    await db.generationJob.update({
      where: { id: jobId },
      data: {
        status: "succeeded",
        currentStep: "succeeded",
        progress: 100,
        gameId: published.gameId,
        costEstimated,
        finishedAt: new Date()
      }
    });

    return published;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown generation failure";
    await db.generationJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        currentStep: "failed",
        progress: 100,
        errorMessage: message,
        finishedAt: new Date()
      }
    });
    throw error;
  }
}
