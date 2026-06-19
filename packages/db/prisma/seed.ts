import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/client";
import { runBuildPackagerAgent } from "@ai-arcade/agent/agents/packager";
import { runPublishAgent } from "@ai-arcade/agent/agents/publisher";
import { runGenerationJob } from "@ai-arcade/agent/orchestrator";
import { generateGameFiles } from "@ai-arcade/agent/local-generator";
import type { GameDesignSpec, IntentPlan } from "@ai-arcade/agent/types";
import { ensureCoreBuckets } from "@ai-arcade/storage/minio";

const creatorEmail = "creator@example.com";
const creatorPassword = "password123";

function manualIntent(seed: number, style: string): IntentPlan {
  return {
    genre: "arcade",
    coreMechanics: ["move", "avoid", "collect"],
    artStyle: style,
    playerGoal: "score high while surviving",
    winCondition: "finish the round",
    loseCondition: "lose all lives",
    controls: ["Arrow keys", "WASD", "mouse or touch drag"],
    entities: ["hero", "hazards", "rewards"],
    mood: "quick and readable",
    seed
  };
}

async function seedManualGame(userId: string, design: GameDesignSpec, intent: IntentPlan) {
  const existing = await db.game.findFirst({
    where: {
      authorId: userId,
      title: design.title
    }
  });
  if (existing) {
    console.log(`[seed] manual game exists: ${design.title}`);
    return existing.id;
  }

  const files = generateGameFiles(design, intent);
  const artifact = await runBuildPackagerAgent({ design, files, jobId: null });
  const published = await runPublishAgent({
    userId,
    jobId: null,
    artifact,
    status: "published"
  });
  console.log(`[seed] published manual game: ${design.title}`);
  return published.gameId;
}

async function main() {
  await ensureCoreBuckets();

  const passwordHash = await bcrypt.hash(creatorPassword, 12);
  const user = await db.user.upsert({
    where: { email: creatorEmail },
    update: {
      username: "Creator Demo"
    },
    create: {
      email: creatorEmail,
      username: "Creator Demo",
      passwordHash,
      accounts: {
        create: {
          provider: "credentials",
          providerAccountId: creatorEmail
        }
      }
    }
  });

  await db.account.upsert({
    where: {
      provider_providerAccountId: {
        provider: "credentials",
        providerAccountId: creatorEmail
      }
    },
    update: { userId: user.id },
    create: {
      userId: user.id,
      provider: "credentials",
      providerAccountId: creatorEmail
    }
  });

  await seedManualGame(
    user.id,
    {
      title: "Pixel Runner",
      description: "A compact runner where a bright pixel courier dodges blockers and collects charge cells.",
      tags: ["runner", "pixel", "manual-seed"],
      coverPrompt: "pixel runner arcade cover",
      gameplayLoop: "Move through lanes, dodge blockers, collect charge cells, and survive the timer.",
      controls: ["Arrow keys", "WASD", "mouse or touch drag"],
      scoring: "Collectibles add points and remaining lives add a bonus.",
      difficulty: "easy",
      runtimeRequirements: ["HTML5 Canvas", "iframe sandbox", "postMessage telemetry"],
      theme: {
        background: "#16181d",
        primary: "#70e000",
        accent: "#fbbf24",
        danger: "#f97316"
      },
      durationSeconds: 30
    },
    manualIntent(7001, "crisp arcade pixel art")
  );

  await seedManualGame(
    user.id,
    {
      title: "Memory Garden",
      description: "A gentle garden challenge where players avoid thorns and gather glowing memory blooms.",
      tags: ["memory", "garden", "manual-seed"],
      coverPrompt: "botanical memory garden arcade cover",
      gameplayLoop: "Guide the gardener, avoid thorns, collect blooms, and finish with the best memory score.",
      controls: ["Arrow keys", "WASD", "mouse or touch drag"],
      scoring: "Blooms add points and collisions remove lives.",
      difficulty: "medium",
      runtimeRequirements: ["HTML5 Canvas", "iframe sandbox", "postMessage telemetry"],
      theme: {
        background: "#18231f",
        primary: "#9be564",
        accent: "#f6d365",
        danger: "#f25f5c"
      },
      durationSeconds: 35
    },
    manualIntent(8137, "soft botanical pixel art")
  );

  const generatedExists = await db.game.findFirst({
    where: {
      authorId: user.id,
      tags: { has: "seed-agent" }
    }
  });

  if (!generatedExists) {
    const prompt = "做一个太空飞船躲避陨石并收集能量的 30 秒小游戏，像素风格，方向键移动，结束后显示得分。";
    const job = await db.generationJob.create({
      data: {
        userId: user.id,
        prompt,
        inputAssets: [],
        status: "pending",
        currentStep: "seed-created",
        progress: 0
      }
    });
    const result = await runGenerationJob(job.id);
    const game = await db.game.findUniqueOrThrow({ where: { id: result.gameId } });
    await db.game.update({
      where: { id: game.id },
      data: {
        status: "published",
        publishedAt: new Date(),
        tags: Array.from(new Set([...game.tags, "seed-agent"]))
      }
    });
    console.log(`[seed] generated and published agent game: ${result.gameId}`);
  } else {
    console.log("[seed] generated agent game already exists");
  }

  console.log(`[seed] test user ready: ${creatorEmail} / ${creatorPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
