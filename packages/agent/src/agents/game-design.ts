import {
  callOpenAICompatibleJson,
  shouldUseLocalFallback,
} from "../model-provider";
import { designGameFromIntent } from "../local-generator";
import type { GameDesignSpec, IntentPlan } from "../types";

export async function runGameDesignAgent(
  prompt: string,
  intent: IntentPlan,
): Promise<GameDesignSpec> {
  const remote = await callOpenAICompatibleJson<GameDesignSpec>([
    {
      role: "system",
      content:
        "You are GameDesignAgent. Return strict JSON matching title, description, tags, coverPrompt, gameplayLoop, controls, scoring, difficulty, runtimeRequirements, theme, durationSeconds.",
    },
    { role: "user", content: JSON.stringify({ prompt, intent }) },
  ]);

  if (remote?.title && Array.isArray(remote.tags) && remote.theme)
    return remote;
  if (!shouldUseLocalFallback()) {
    throw new Error(
      "真实模型未返回有效 GameDesign JSON，不能执行 AI 原创生成。",
    );
  }
  return designGameFromIntent(prompt, intent);
}
