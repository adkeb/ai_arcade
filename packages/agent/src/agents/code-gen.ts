import { generateGameFiles } from "../local-generator";
import type { GameDesignSpec, GameSourceFiles, IntentPlan } from "../types";

export async function runCodeGenAgent(design: GameDesignSpec, intent: IntentPlan): Promise<GameSourceFiles> {
  return generateGameFiles(design, intent);
}
