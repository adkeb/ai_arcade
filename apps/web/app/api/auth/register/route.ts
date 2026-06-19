import bcrypt from "bcryptjs";
import { db } from "@ai-arcade/db";
import { registerSchema } from "@ai-arcade/shared/schemas";
import {
  createUserSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import { fail, ok, parseError, validationFailureFor } from "@/lib/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    const email = body.email.toLowerCase();
    const passwordHash = await bcrypt.hash(body.password, 12);

    const user = await db.user.create({
      data: {
        email,
        username: body.username,
        passwordHash,
        accounts: {
          create: {
            provider: "credentials",
            providerAccountId: email,
          },
        },
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
      },
    });

    const session = await createUserSession(user.id);
    const response = ok({ user });
    response.cookies.set(
      SESSION_COOKIE,
      session.token,
      sessionCookieOptions(session.expiresAt),
    );
    return response;
  } catch (error) {
    const validation = validationFailureFor(error, {
      email: {
        code: "INVALID_EMAIL",
        message: "Please enter a valid email address.",
      },
      username: {
        code: "INVALID_USERNAME",
        message: "Username must be between 2 and 80 characters.",
      },
      password: {
        code: "PASSWORD_TOO_SHORT",
        message: "Password must be at least 8 characters.",
      },
    });
    if (validation) return fail(validation.code, validation.message, 400);

    const message = parseError(error);
    if (message.includes("Unique constraint")) {
      return fail("EMAIL_EXISTS", "This email is already registered.", 409);
    }
    return fail("REGISTER_FAILED", message, 400);
  }
}
