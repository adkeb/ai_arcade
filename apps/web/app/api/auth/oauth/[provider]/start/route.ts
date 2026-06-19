import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildAuthorizationUrl, getOAuthConfig, oauthStateCookie, parseOAuthProvider } from "@/lib/oauth";

export const runtime = "nodejs";

type Context = {
  params: Promise<{ provider: string }>;
};

function redirectWithError(request: Request, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("oauth_error", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request, context: Context) {
  try {
    const { provider: providerParam } = await context.params;
    const provider = parseOAuthProvider(providerParam);
    if (!provider) return redirectWithError(request, "Unsupported OAuth provider.");

    const config = getOAuthConfig(provider, request);
    const state = randomBytes(24).toString("base64url");
    const response = NextResponse.redirect(buildAuthorizationUrl(config, state));
    response.cookies.set(oauthStateCookie(provider), state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 10 * 60,
      path: `/api/auth/oauth/${provider}`
    });
    return response;
  } catch (error) {
    return redirectWithError(request, error instanceof Error ? error.message : "OAuth start failed.");
  }
}
