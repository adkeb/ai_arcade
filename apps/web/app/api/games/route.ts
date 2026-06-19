import { db } from "@ai-arcade/db";
import { gamesQuerySchema } from "@ai-arcade/shared/schemas";
import { fail, ok, parseError } from "@/lib/api-response";
import { filterShowcaseGames, selectShowcaseGames } from "@/lib/game-showcase";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = gamesQuerySchema.parse({
      search: url.searchParams.get("search") || undefined,
      tag: url.searchParams.get("tag") || undefined,
    });

    const games = await db.game.findMany({
      where: {
        status: "published",
        currentVersionId: { not: null },
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        currentVersion: true,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });

    const showcaseGames = selectShowcaseGames(games);
    return ok({
      games: filterShowcaseGames(showcaseGames, {
        search: query.search,
        tag: query.tag,
      }),
    });
  } catch (error) {
    return fail("LIST_GAMES_FAILED", parseError(error), 400);
  }
}
