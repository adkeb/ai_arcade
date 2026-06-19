import { db } from "@ai-arcade/db";
import { fail, ok, parseError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ gameId: string; versionId: string }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user)
      return fail(
        "UNAUTHORIZED",
        "Please log in before rolling back a game.",
        401,
      );

    const { gameId, versionId } = await context.params;
    const version = await db.gameVersion.findFirst({
      where: { id: versionId, gameId },
      include: {
        game: { select: { id: true, authorId: true } },
      },
    });

    if (!version) return fail("VERSION_NOT_FOUND", "Version not found.", 404);
    if (version.game.authorId !== user.id)
      return fail("FORBIDDEN", "Only the author can roll back this game.", 403);
    if (version.buildStatus !== "succeeded")
      return fail(
        "VERSION_NOT_READY",
        "Only succeeded versions can be restored.",
        409,
      );

    const game = await db.game.update({
      where: { id: version.game.id },
      data: { currentVersionId: version.id },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        currentVersion: true,
        versions: { orderBy: { versionNumber: "desc" } },
      },
    });

    return ok({ game });
  } catch (error) {
    return fail("ROLLBACK_FAILED", parseError(error), 400);
  }
}
