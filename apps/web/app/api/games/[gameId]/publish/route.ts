import { db } from "@ai-arcade/db";
import { fail, ok, parseError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ gameId: string }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHORIZED", "Please log in before publishing.", 401);

    const { gameId } = await context.params;
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: { currentVersion: true }
    });

    if (!game) return fail("GAME_NOT_FOUND", "Game not found.", 404);
    if (game.authorId !== user.id) return fail("FORBIDDEN", "Only the author can publish this game.", 403);
    if (!game.currentVersion) return fail("MISSING_VERSION", "Game has no generated version to publish.", 409);

    const updated = await db.game.update({
      where: { id: game.id },
      data: {
        status: "published",
        publishedAt: game.publishedAt ?? new Date()
      },
      include: {
        author: { select: { id: true, username: true } },
        currentVersion: true
      }
    });

    return ok({ game: updated });
  } catch (error) {
    return fail("PUBLISH_FAILED", parseError(error), 400);
  }
}
