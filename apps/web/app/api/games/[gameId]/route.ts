import { db } from "@ai-arcade/db";
import { updateGameSchema } from "@ai-arcade/shared/schemas";
import { fail, ok, parseError, validationFailureFor } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ gameId: string }>;
};

export async function GET(_request: Request, context: Context) {
  const { gameId } = await context.params;
  const user = await getCurrentUser();
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      author: { select: { id: true, username: true, avatarUrl: true } },
      currentVersion: true,
    },
  });

  if (!game) return fail("GAME_NOT_FOUND", "Game not found.", 404);
  if (game.status !== "published" && game.authorId !== user?.id) {
    return fail(
      "FORBIDDEN",
      "This draft game is only visible to its author.",
      403,
    );
  }

  return ok({ game });
}

export async function PATCH(request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return fail("UNAUTHORIZED", "Please log in before editing a game.", 401);

    const { gameId } = await context.params;
    const body = updateGameSchema.parse(await request.json());
    const game = await db.game.findUnique({
      where: { id: gameId },
      select: { id: true, authorId: true },
    });

    if (!game) return fail("GAME_NOT_FOUND", "Game not found.", 404);
    if (game.authorId !== user.id)
      return fail("FORBIDDEN", "Only the author can edit this game.", 403);

    const updated = await db.game.update({
      where: { id: game.id },
      data: {
        title: body.title,
        description: body.description,
        tags: body.tags,
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        currentVersion: true,
      },
    });

    return ok({ game: updated });
  } catch (error) {
    const validation = validationFailureFor(error, {
      title: {
        code: "INVALID_TITLE",
        message: "Title must be between 2 and 80 characters.",
      },
      description: {
        code: "INVALID_DESCRIPTION",
        message: "Description must be between 10 and 500 characters.",
      },
      tags: {
        code: "INVALID_TAGS",
        message: "Tags must contain up to 8 short labels.",
      },
    });
    if (validation) return fail(validation.code, validation.message, 400);
    return fail("UPDATE_GAME_FAILED", parseError(error), 400);
  }
}
