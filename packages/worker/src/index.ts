import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { db } from "@ai-arcade/db";
import { runGenerationJobById } from "./job-runner";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

const worker = new Worker(
  "generation",
  async (job) => {
    const jobId = String(job.data.jobId ?? "");
    if (!jobId) throw new Error("Missing generation jobId");
    await runGenerationJobById(jobId);
  },
  {
    connection,
    concurrency: 2,
    lockDuration: Number(process.env.JOB_TIMEOUT_SECONDS ?? 120) * 1000
  }
);

worker.on("completed", (job) => {
  console.log(`[worker] completed queue job ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`[worker] failed queue job ${job?.id}:`, error);
});

process.on("SIGINT", async () => {
  await worker.close();
  await connection.quit();
  await db.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await worker.close();
  await connection.quit();
  await db.$disconnect();
  process.exit(0);
});

console.log("[worker] AI Arcade generation worker is running");
