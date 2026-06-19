import { Prisma, db } from "@ai-arcade/db";
import { telemetrySchema } from "@ai-arcade/shared/schemas";
import { fail, ok, parseError } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = telemetrySchema.parse(await request.json());
    const user = await getCurrentUser();
    const game = await db.game.findUnique({ where: { id: body.gameId }, select: { id: true } });
    if (!game) return fail("GAME_NOT_FOUND", "Game not found.", 404);

    const event = await db.playEvent.create({
      data: {
        gameId: body.gameId,
        userId: user?.id,
        eventType: body.eventType,
        payload: body.payload as Prisma.InputJsonValue
      }
    });

    if (body.eventType === "play_start") {
      await db.game.update({
        where: { id: body.gameId },
        data: { playCount: { increment: 1 } }
      });
    }

    return ok({ eventId: event.id });
  } catch (error) {
    return fail("TELEMETRY_FAILED", parseError(error), 400);
  }
}
