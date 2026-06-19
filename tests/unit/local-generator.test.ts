import assert from "node:assert/strict";
import test from "node:test";
import {
  designGameFromIntent,
  generateGameFiles,
  planIntentFromPrompt,
} from "@ai-arcade/agent/local-generator";
import type { IntentPlan } from "@ai-arcade/agent/types";

function extractConfig(files: ReturnType<typeof generateGameFiles>) {
  const match = files.gameJs.match(/const config = (\{.*?\});/s);
  assert(match?.[1], "game.js should embed a JSON config");
  return JSON.parse(match[1]) as { mode: NonNullable<IntentPlan["mode"]> };
}

const prompts: Array<{
  name: string;
  prompt: string;
  mode: NonNullable<IntentPlan["mode"]>;
  overlayHint: string;
}> = [
  {
    name: "avoid and collect",
    prompt: "做一个太空飞船躲避陨石并收集能量的 30 秒小游戏，方向键移动。",
    mode: "avoid-collect",
    overlayHint: "Move with Arrow keys",
  },
  {
    name: "memory match",
    prompt: "做一个记忆翻牌配对小游戏，玩家点击卡牌找到所有相同图案。",
    mode: "memory-match",
    overlayHint: "Tap cards",
  },
  {
    name: "runner",
    prompt: "做一个横版跑酷 runner 小游戏，玩家按空格跳跃躲避障碍并收集金币。",
    mode: "runner",
    overlayHint: "Jump with Space",
  },
  {
    name: "garden sequence",
    prompt: "做一个花园序列记忆小游戏，玩家观察花朵亮起顺序并按顺序点击花床。",
    mode: "garden-sequence",
    overlayHint: "Watch the bloom order",
  },
];

test("local generator maps distinct prompts to distinct playable modes", () => {
  const seenModes = new Set<string>();
  const seenGameHashes = new Set<string>();

  for (const item of prompts) {
    const intent = planIntentFromPrompt(item.prompt, []);
    assert.equal(
      intent.mode,
      item.mode,
      `${item.name} should infer the requested mode`,
    );

    const design = designGameFromIntent(item.prompt, intent);
    const files = generateGameFiles(design, intent);
    const config = extractConfig(files);

    assert.equal(config.mode, item.mode);
    assert.match(files.indexHtml, new RegExp(item.overlayHint));
    assert.match(design.tags.join(","), new RegExp(item.mode));
    seenModes.add(config.mode);
    seenGameHashes.add(files.gameJs);
  }

  assert.equal(seenModes.size, prompts.length);
  assert.equal(seenGameHashes.size, prompts.length);
});

test("local generator preserves garden sequence genre when intent omits mode", () => {
  const prompt =
    "做一个花园序列记忆小游戏，玩家观察花朵亮起顺序并按顺序点击花床。";
  const intent = planIntentFromPrompt(prompt, []);
  const intentWithoutMode: IntentPlan = {
    ...intent,
    mode: undefined,
    genre: "garden sequence puzzle",
  };
  const design = designGameFromIntent(prompt, intentWithoutMode);
  const files = generateGameFiles(design, intentWithoutMode);
  const config = extractConfig(files);

  assert.equal(config.mode, "garden-sequence");
  assert.match(files.indexHtml, /Watch the bloom order/);
});
