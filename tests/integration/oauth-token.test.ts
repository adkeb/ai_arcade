import assert from "node:assert/strict";
import test from "node:test";
import { db } from "@ai-arcade/db";
import { upsertOAuthUser } from "../../apps/web/lib/oauth";

const hasDatabase = Boolean(process.env.DATABASE_URL);

test(
  "OAuth upsert encrypts provider tokens at rest",
  { skip: hasDatabase ? false : "DATABASE_URL is not set" },
  async () => {
    const previousSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "integration-oauth-secret";
    const email = `oauth-${Date.now()}@example.com`;
    const providerAccountId = `github-${Date.now()}`;
    const accessToken = "plain-access-token-for-test";
    const refreshToken = "plain-refresh-token-for-test";

    try {
      await db.user.deleteMany({ where: { email } });
      const user = await upsertOAuthUser(
        {
          provider: "github",
          providerAccountId,
          email,
          username: "OAuth Test",
          avatarUrl: null,
        },
        { accessToken, refreshToken },
      );

      const account = await db.account.findUniqueOrThrow({
        where: {
          provider_providerAccountId: {
            provider: "github",
            providerAccountId,
          },
        },
      });

      assert.equal(account.userId, user.id);
      assert.match(account.accessTokenEncrypted ?? "", /^v1:/);
      assert.match(account.refreshTokenEncrypted ?? "", /^v1:/);
      assert.equal(account.accessTokenEncrypted?.includes(accessToken), false);
      assert.equal(
        account.refreshTokenEncrypted?.includes(refreshToken),
        false,
      );
    } finally {
      await db.user.deleteMany({ where: { email } }).catch(() => undefined);
      await db.$disconnect();
      process.env.SESSION_SECRET = previousSecret;
    }
  },
);
