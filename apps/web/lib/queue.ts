import { Queue } from "bullmq";
import IORedis from "ioredis";

const globalForQueue = globalThis as unknown as {
  generationConnection?: IORedis;
  generationQueue?: Queue;
};

export function getGenerationQueue(): Queue {
  if (!globalForQueue.generationConnection) {
    globalForQueue.generationConnection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null
    });
  }
  if (!globalForQueue.generationQueue) {
    globalForQueue.generationQueue = new Queue("generation", {
      connection: globalForQueue.generationConnection
    });
  }
  return globalForQueue.generationQueue;
}
