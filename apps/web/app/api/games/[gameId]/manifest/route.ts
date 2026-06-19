import { db } from "@ai-arcade/db";
import { fail, ok } from "@/lib/api-response";
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
    include: { currentVersion: true }
  });

  if (!game || !game.currentVersion) return fail("GAME_NOT_FOUND", "Game manifest not found.", 404);
  if (game.status !== "published" && game.authorId !== user?.id) {
    return fail("FORBIDDEN", "Draft manifest is only visible to its author.", 403);
  }

  return ok({
    gameId: game.id,
    manifestUrl: game.currentVersion.manifestUrl,
    artifactBaseUrl: game.currentVersion.artifactBaseUrl,
    manifestJson: game.currentVersion.manifestJson
  });
}
