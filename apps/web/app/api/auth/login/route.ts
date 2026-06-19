import bcrypt from "bcryptjs";
import { db } from "@ai-arcade/db";
import { loginSchema } from "@ai-arcade/shared/schemas";
import { createUserSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { fail, ok, parseError } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const user = await db.user.findUnique({
      where: { email: body.email.toLowerCase() }
    });

    if (!user) return fail("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) return fail("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);

    const session = await createUserSession(user.id);
    const response = ok({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatarUrl: user.avatarUrl
      }
    });
    response.cookies.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    return fail("LOGIN_FAILED", parseError(error), 400);
  }
}
