import { runGenerationJob } from "@ai-arcade/agent/orchestrator";

export async function runGenerationJobById(jobId: string): Promise<void> {
  await runGenerationJob(jobId);
}
