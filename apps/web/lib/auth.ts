import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { db } from "@ai-arcade/db";

export const SESSION_COOKIE = "ai_arcade_session";
const SESSION_DAYS = 7;

export type SessionUser = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
};

export function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(`${token}:${process.env.SESSION_SECRET ?? "dev-secret"}`)
    .digest("hex");
}

export async function createUserSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt
    }
  });
  return { token, expiresAt };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/"
  };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          avatarUrl: true
        }
      }
    }
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  return session.user;
}

export async function clearCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return;

  await db.session
    .delete({
      where: { tokenHash: hashSessionToken(token) }
    })
    .catch(() => undefined);
}
