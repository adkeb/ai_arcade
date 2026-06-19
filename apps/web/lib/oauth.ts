import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@ai-arcade/db";

export type OAuthProvider = "github" | "google";

type OAuthConfig = {
  provider: OAuthProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type OAuthProfile = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  username: string;
  avatarUrl: string | null;
};

type TokenPayload = {
  access_token?: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

const userSelect = {
  id: true,
  email: true,
  username: true,
  avatarUrl: true
};

export function parseOAuthProvider(value: string): OAuthProvider | null {
  return value === "github" || value === "google" ? value : null;
}

export function oauthStateCookie(provider: OAuthProvider) {
  return `ai_arcade_oauth_${provider}_state`;
}

export function getOAuthConfig(provider: OAuthProvider, request: Request): OAuthConfig {
  const origin = process.env.APP_URL || new URL(request.url).origin;
  const clientId = provider === "github" ? process.env.GITHUB_CLIENT_ID : process.env.GOOGLE_CLIENT_ID;
  const clientSecret = provider === "github" ? process.env.GITHUB_CLIENT_SECRET : process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(`${provider.toUpperCase()} OAuth is not configured. Set client id and client secret environment variables.`);
  }

  return {
    provider,
    clientId,
    clientSecret,
    redirectUri: `${origin.replace(/\/+$/g, "")}/api/auth/oauth/${provider}/callback`
  };
}

export function buildAuthorizationUrl(config: OAuthConfig, state: string) {
  if (config.provider === "github") {
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    return url;
  }

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  return url;
}

async function exchangeCodeForToken(config: OAuthConfig, code: string): Promise<string> {
  const endpoint = config.provider === "github" ? "https://github.com/login/oauth/access_token" : "https://oauth2.googleapis.com/token";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    })
  });

  const payload = (await response.json()) as TokenPayload;
  if (!response.ok || payload.error || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "OAuth token exchange failed.");
  }
  return payload.access_token;
}

async function fetchGitHubProfile(accessToken: string): Promise<OAuthProfile> {
  const [userResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/vnd.github+json" }
    }),
    fetch("https://api.github.com/user/emails", {
      headers: { authorization: `Bearer ${accessToken}`, accept: "application/vnd.github+json" }
    })
  ]);

  if (!userResponse.ok) throw new Error("GitHub profile request failed.");
  const user = (await userResponse.json()) as {
    id?: number | string;
    login?: string;
    name?: string;
    email?: string | null;
    avatar_url?: string | null;
  };

  const emails = emailsResponse.ok
    ? ((await emailsResponse.json()) as Array<{ email?: string; primary?: boolean; verified?: boolean }>)
    : [];
  const email = user.email || emails.find((item) => item.primary && item.verified)?.email || emails.find((item) => item.verified)?.email;

  if (!user.id || !email) throw new Error("GitHub did not return a verified email.");

  return {
    provider: "github",
    providerAccountId: String(user.id),
    email: email.toLowerCase(),
    username: user.name || user.login || email.split("@")[0]!,
    avatarUrl: user.avatar_url ?? null
  };
}

async function fetchGoogleProfile(accessToken: string): Promise<OAuthProfile> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error("Google profile request failed.");

  const user = (await response.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  if (!user.sub || !user.email || !user.email_verified) throw new Error("Google did not return a verified email.");

  return {
    provider: "google",
    providerAccountId: user.sub,
    email: user.email.toLowerCase(),
    username: user.name || user.email.split("@")[0]!,
    avatarUrl: user.picture ?? null
  };
}

export async function fetchOAuthProfile(config: OAuthConfig, code: string): Promise<OAuthProfile> {
  const accessToken = await exchangeCodeForToken(config, code);
  return config.provider === "github" ? fetchGitHubProfile(accessToken) : fetchGoogleProfile(accessToken);
}

export async function upsertOAuthUser(profile: OAuthProfile) {
  const passwordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), 12);

  return db.$transaction(async (tx) => {
    const account = await tx.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId
        }
      },
      include: {
        user: {
          select: userSelect
        }
      }
    });

    if (account) {
      if (profile.avatarUrl && account.user.avatarUrl !== profile.avatarUrl) {
        return tx.user.update({
          where: { id: account.userId },
          data: { avatarUrl: profile.avatarUrl },
          select: userSelect
        });
      }
      return account.user;
    }

    const existingUser = await tx.user.findUnique({
      where: { email: profile.email },
      select: userSelect
    });

    const user =
      existingUser ??
      (await tx.user.create({
        data: {
          email: profile.email,
          username: profile.username,
          avatarUrl: profile.avatarUrl,
          passwordHash
        },
        select: userSelect
      }));

    await tx.account.create({
      data: {
        userId: user.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId
      }
    });

    if (profile.avatarUrl && user.avatarUrl !== profile.avatarUrl) {
      return tx.user.update({
        where: { id: user.id },
        data: { avatarUrl: profile.avatarUrl },
        select: userSelect
      });
    }

    return user;
  });
}
