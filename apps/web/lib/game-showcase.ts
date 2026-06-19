export const SHOWCASE_MODE_TAGS = [
  "avoid-collect",
  "memory-match",
  "runner",
  "garden-sequence",
] as const;

export type ShowcaseModeTag = (typeof SHOWCASE_MODE_TAGS)[number];

type ShowcaseCandidate = {
  title: string;
  description: string;
  tags: string[];
  currentVersion?: unknown | null;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export function getShowcaseModeTag(
  tags: readonly string[],
): ShowcaseModeTag | null {
  return SHOWCASE_MODE_TAGS.find((mode) => tags.includes(mode)) ?? null;
}

function dateValue(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function newestFirst<T extends ShowcaseCandidate>(left: T, right: T): number {
  return (
    dateValue(right.publishedAt) - dateValue(left.publishedAt) ||
    dateValue(right.createdAt) - dateValue(left.createdAt)
  );
}

export function selectShowcaseGames<T extends ShowcaseCandidate>(
  games: readonly T[],
): T[] {
  const newestByMode = new Map<ShowcaseModeTag, T>();
  const sorted = [...games]
    .filter((game) => game.currentVersion)
    .sort(newestFirst);

  for (const game of sorted) {
    const mode = getShowcaseModeTag(game.tags);
    if (mode && !newestByMode.has(mode)) {
      newestByMode.set(mode, game);
    }
  }

  return SHOWCASE_MODE_TAGS.flatMap((mode) => {
    const game = newestByMode.get(mode);
    return game ? [game] : [];
  });
}

export function filterShowcaseGames<T extends ShowcaseCandidate>(
  games: readonly T[],
  filters: { search?: string; tag?: string },
): T[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const tag = filters.tag?.trim() ?? "";

  return games.filter((game) => {
    const matchesSearch =
      !search ||
      game.title.toLowerCase().includes(search) ||
      game.description.toLowerCase().includes(search);
    const matchesTag = !tag || game.tags.includes(tag);
    return matchesSearch && matchesTag;
  });
}
