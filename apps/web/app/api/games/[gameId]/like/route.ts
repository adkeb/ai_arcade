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
    if (!user) return fail("UNAUTHORIZED", "Please log in before liking a game.", 401);

    const { gameId } = await context.params;
    const game = await db.game.findFirst({
      where: { id: gameId, status: "published" },
      select: { id: true }
    });
    if (!game) return fail("GAME_NOT_FOUND", "Published game not found.", 404);

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: { userId_gameId: { userId: user.id, gameId } }
      });

      if (existing) {
        await tx.like.delete({ where: { id: existing.id } });
      } else {
        await tx.like.create({ data: { userId: user.id, gameId } });
      }

      const count = await tx.like.count({ where: { gameId } });
      await tx.game.update({
        where: { id: gameId },
        data: { likeCount: count }
      });

      return { liked: !existing, likeCount: count };
    });

    return ok(result);
  } catch (error) {
    return fail("LIKE_FAILED", parseError(error), 400);
  }
}
