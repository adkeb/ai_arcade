import {
  callOpenAICompatibleJson,
  shouldUseLocalFallback,
} from "../model-provider";
import { planIntentFromPrompt } from "../local-generator";
import type { AssetSummary, IntentPlan } from "../types";

export async function runIntentPlannerAgent(
  prompt: string,
  assets: AssetSummary[],
): Promise<IntentPlan> {
  const remote = await callOpenAICompatibleJson<IntentPlan>([
    {
      role: "system",
      content:
        "You are IntentPlannerAgent. Return strict JSON with genre, coreMechanics, artStyle, playerGoal, winCondition, loseCondition, controls, entities, mood, seed.",
    },
    {
      role: "user",
      content: JSON.stringify({
        prompt,
        assets: assets.map((asset) => ({
          name: asset.originalName,
          mimeType: asset.mimeType,
          size: asset.size,
          analysis: asset.analysis
            ? {
                summary: asset.analysis.summary,
                textExcerpt: asset.analysis.textExcerpt,
                metadata: asset.analysis.metadata,
              }
            : null,
        })),
      }),
    },
  ]);

  if (remote?.genre && Array.isArray(remote.coreMechanics)) return remote;
  if (!shouldUseLocalFallback()) {
    throw new Error(
      "真实模型未返回有效 IntentPlanner JSON，不能执行 AI 原创生成。",
    );
  }
  return planIntentFromPrompt(prompt, assets);
}
