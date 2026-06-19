import { NextResponse } from "next/server";
import {
  createUserSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  fetchOAuthProfile,
  getOAuthConfig,
  oauthStateCookie,
  parseOAuthProvider,
  publicAppUrl,
  upsertOAuthUser,
} from "@/lib/oauth";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ provider: string }>;
};

function redirectWithError(request: Request, message: string) {
  const url = publicAppUrl(request, "/login");
  url.searchParams.set("oauth_error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request, context: Context) {
  const { provider: providerParam } = await context.params;
  const provider = parseOAuthProvider(providerParam);
  if (!provider)
    return redirectWithError(request, "Unsupported OAuth provider.");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError =
    url.searchParams.get("error_description") || url.searchParams.get("error");
  const expectedState = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${oauthStateCookie(provider)}=`))
    ?.split("=")[1];

  try {
    if (providerError) throw new Error(providerError);
    if (!code || !state || !expectedState || state !== expectedState)
      throw new Error("OAuth state validation failed.");

    const config = getOAuthConfig(provider, request);
    const { profile, tokens } = await fetchOAuthProfile(config, code);
    const user = await upsertOAuthUser(profile, tokens);
    const session = await createUserSession(user.id);

    const response = NextResponse.redirect(publicAppUrl(request, "/create"));
    response.cookies.set(
      SESSION_COOKIE,
      session.token,
      sessionCookieOptions(session.expiresAt),
    );
    response.cookies.set(oauthStateCookie(provider), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(0),
      path: `/api/auth/oauth/${provider}`,
    });
    return response;
  } catch (error) {
    const response = redirectWithError(
      request,
      error instanceof Error ? error.message : "OAuth callback failed.",
    );
    response.cookies.set(oauthStateCookie(provider), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      expires: new Date(0),
      path: `/api/auth/oauth/${provider}`,
    });
    return response;
  }
}
