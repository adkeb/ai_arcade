import { db } from "@ai-arcade/db";
import { gamesQuerySchema } from "@ai-arcade/shared/schemas";
import { fail, ok, parseError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = gamesQuerySchema.parse({
      search: url.searchParams.get("search") || undefined,
      tag: url.searchParams.get("tag") || undefined
    });

    const games = await db.game.findMany({
      where: {
        status: "published",
        ...(query.search
          ? {
              OR: [
                { title: { contains: query.search, mode: "insensitive" as const } },
                { description: { contains: query.search, mode: "insensitive" as const } }
              ]
            }
          : {}),
        ...(query.tag ? { tags: { has: query.tag } } : {})
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        currentVersion: true
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]
    });

    return ok({ games });
  } catch (error) {
    return fail("LIST_GAMES_FAILED", parseError(error), 400);
  }
}
