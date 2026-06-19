import assert from "node:assert/strict";
import test from "node:test";
import { filterShowcaseGames, selectShowcaseGames } from "@/lib/game-showcase";

type TestGame = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  currentVersion: { id: string } | null;
  publishedAt: string;
  createdAt: string;
};

function game(
  id: string,
  mode: string,
  publishedAt: string,
  overrides: Partial<TestGame> = {},
): TestGame {
  return {
    id,
    title: `${mode} ${id}`,
    description: `Description for ${mode} ${id}`,
    tags: [mode, "generated"],
    currentVersion: { id: `version-${id}` },
    publishedAt,
    createdAt: publishedAt,
    ...overrides,
  };
}

test("showcase selector keeps the newest published game per supported mode in fixed order", () => {
  const selected = selectShowcaseGames([
    game("avoid-old", "avoid-collect", "2026-06-17T10:00:00.000Z"),
    game("avoid-new", "avoid-collect", "2026-06-18T10:00:00.000Z"),
    game("memory-new", "memory-match", "2026-06-18T09:00:00.000Z"),
    game("runner-new", "runner", "2026-06-18T08:00:00.000Z"),
    game("garden-old", "garden-sequence", "2026-06-16T08:00:00.000Z"),
    game("garden-new", "garden-sequence", "2026-06-18T07:00:00.000Z"),
    game("draftish", "runner", "2026-06-19T08:00:00.000Z", {
      currentVersion: null,
    }),
    game("unsupported", "pinball", "2026-06-19T08:00:00.000Z"),
  ]);

  assert.deepEqual(
    selected.map((item) => item.id),
    ["avoid-new", "memory-new", "runner-new", "garden-new"],
  );
});

test("showcase search and tag filters only apply within selected representatives", () => {
  const selected = selectShowcaseGames([
    game("avoid-old", "avoid-collect", "2026-06-17T10:00:00.000Z", {
      title: "Crystal keyword old",
    }),
    game("avoid-new", "avoid-collect", "2026-06-18T10:00:00.000Z", {
      title: "Newest avoid",
    }),
    game("memory-new", "memory-match", "2026-06-18T09:00:00.000Z", {
      description: "Crystal keyword selected",
    }),
    game("runner-new", "runner", "2026-06-18T08:00:00.000Z"),
  ]);

  assert.deepEqual(
    filterShowcaseGames(selected, { search: "crystal" }).map((item) => item.id),
    ["memory-new"],
  );
  assert.deepEqual(
    filterShowcaseGames(selected, { tag: "runner" }).map((item) => item.id),
    ["runner-new"],
  );
});
