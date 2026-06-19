import { fail, ok, parseError } from "@/lib/api-response";
import { clearCurrentSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearCurrentSession();
    const response = ok({ loggedOut: true });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(0),
      path: "/"
    });
    return response;
  } catch (error) {
    return fail("LOGOUT_FAILED", parseError(error), 400);
  }
}
