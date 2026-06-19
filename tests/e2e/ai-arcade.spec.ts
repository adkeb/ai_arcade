import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type GamesResponse = {
  ok: true;
  data: {
    games: Array<{
      id: string;
      title: string;
      tags: string[];
      currentVersion: {
        manifestUrl: string;
        artifactBaseUrl: string;
      } | null;
    }>;
  };
};

const screenshotDir = path.join(process.cwd(), "test-results", "screenshots");

async function loginCreator(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page
    .getByPlaceholder("creator@example.com")
    .fill("creator@example.com");
  await page.getByPlaceholder("password123").fill("password123");
  await page.getByRole("button", { name: "Login" }).click();
  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
}

test.beforeAll(async () => {
  await mkdir(screenshotDir, { recursive: true });
});

test("oauth buttons handle provider configuration", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Continue with GitHub" }).click();
  await page.waitForURL(
    (url) =>
      url.searchParams.has("oauth_error") || url.hostname === "github.com",
  );
  const redirectedUrl = new URL(page.url());

  if (redirectedUrl.hostname === "github.com") {
    expect(redirectedUrl.pathname).toContain("/login");
    expect(redirectedUrl.searchParams.get("client_id")).toBeTruthy();
    return;
  }

  expect(redirectedUrl.hostname).not.toBe("0.0.0.0");
  expect(redirectedUrl.pathname).toBe("/login");
  await expect(page.getByText(/GITHUB OAuth is not configured/)).toBeVisible();
  await page.screenshot({
    path: path.join(screenshotDir, "auth-oauth.png"),
    fullPage: true,
  });
});

test("home lists database games and play loads remote manifest entry", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "AI Arcade" })).toBeVisible();

  const cards = page.locator("article");
  await expect.poll(async () => cards.count()).toBeGreaterThanOrEqual(3);
  await page.screenshot({
    path: path.join(screenshotDir, "home.png"),
    fullPage: true,
  });

  const gamesResponse = await request.get("/api/games");
  expect(gamesResponse.ok()).toBeTruthy();
  const gamesPayload = (await gamesResponse.json()) as GamesResponse;
  expect(gamesPayload.ok).toBeTruthy();
  expect(gamesPayload.data.games.length).toBeGreaterThanOrEqual(3);

  const game =
    gamesPayload.data.games.find(
      (item) =>
        item.tags.includes("manual-seed") && item.currentVersion?.manifestUrl,
    ) ??
    gamesPayload.data.games.find((item) => item.currentVersion?.manifestUrl);
  expect(
    game,
    "expected at least one published game with currentVersion",
  ).toBeTruthy();

  await page.goto(`/?search=${encodeURIComponent(game!.title.slice(0, 6))}`);
  await expect(
    page.getByRole("heading", { name: game!.title }).first(),
  ).toBeVisible();

  if (game!.tags.length > 0) {
    await page.goto(`/?tag=${encodeURIComponent(game!.tags[0]!)}`);
    await expect(
      page.getByRole("link", { name: game!.tags[0]! }).first(),
    ).toBeVisible();
  }

  await page.goto(`/games/${game!.id}`);
  await expect(page.getByRole("heading", { name: game!.title })).toBeVisible();
  await expect(page.getByText("Current artifact")).toBeVisible();
  await expect(page.getByText("Versions")).toBeVisible();
  await page.screenshot({
    path: path.join(screenshotDir, "details.png"),
    fullPage: true,
  });

  await page.goto(`/play/${game!.id}`);
  const runtimePanel = page.locator("aside");
  await expect(page.getByText("Runtime proof")).toBeVisible();
  await expect(runtimePanel).toContainText(game!.currentVersion!.manifestUrl);
  await expect(runtimePanel).toContainText(
    game!.currentVersion!.artifactBaseUrl,
  );

  const iframe = page.locator("iframe");
  await expect(iframe).toBeVisible();
  await expect
    .poll(async () => page.locator("aside").innerText(), {
      message: "Play page should report successful remote iframe load",
    })
    .toContain("success");

  const iframeSrc = await iframe.getAttribute("src");
  expect(iframeSrc).toContain("/game-artifacts/");
  expect(iframeSrc).toContain("/index.html");

  await page.screenshot({
    path: path.join(screenshotDir, "play.png"),
    fullPage: true,
  });
});

test("creator can upload an asset and receive local analysis fallback", async ({
  page,
}) => {
  await loginCreator(page);

  const payload = await page.evaluate(async () => {
    const file = new File(
      [
        new Blob(["# Arcade brief\nUse a bright paddle and falling gems."], {
          type: "text/markdown",
        }),
      ],
      "brief.md",
      { type: "text/markdown" },
    );
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/assets/upload", {
      method: "POST",
      body: formData,
    });
    return response.json();
  });

  expect(payload.ok).toBeTruthy();
  expect(payload.data.analysis.kind).toBe("text");
  expect(payload.data.analysis.textExcerpt).toContain("Arcade brief");
});

test("creator can generate from prompt, publish, edit, regenerate, compare, and roll back", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await loginCreator(page);

  await expect(
    page.getByRole("heading", { name: "Generate a playable HTML5 game" }),
  ).toBeVisible();
  await page.waitForLoadState("networkidle");

  const prompt =
    "做一个纯 prompt 测试用的霓虹飞船小游戏，玩家躲避障碍并收集晶体，30 秒后显示得分。";
  await page.locator("textarea").fill(prompt);
  await expect(page.locator("textarea")).toHaveValue(prompt);
  await page.getByRole("button", { name: "Generate" }).click();

  await expect(page.getByText("Generated artifact")).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText("manifestUrl:")).toBeVisible();
  await expect(page.getByText("artifactBaseUrl:")).toBeVisible();
  await expect(page.getByText("Recent generations")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remix" }).first(),
  ).toBeVisible();

  const previewLink = page.getByRole("link", { name: "Preview" });
  await expect(previewLink).toHaveAttribute("href", /\/play\/.+preview=1/);

  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("button", { name: "Published" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("link", { name: "View Home" })).toBeVisible();
  await page.screenshot({
    path: path.join(screenshotDir, "create-published.png"),
    fullPage: true,
  });

  const playHref = await page
    .getByRole("link", { name: "Play now" })
    .getAttribute("href");
  const gameId = playHref?.match(/\/play\/([^/?]+)/)?.[1];
  expect(gameId).toBeTruthy();

  await page.goto(`/games/${gameId}`);
  await expect(
    page.getByRole("heading", { name: "Author controls" }),
  ).toBeVisible();
  const editedTitle = `E2E Prompt Ship ${Date.now()}`;
  await page.getByLabel("Title").fill(editedTitle);
  await page
    .getByLabel("Description")
    .fill("Updated by Playwright to verify author metadata editing.");
  await page.getByLabel("Tags").fill("e2e, prompt-only, versioned");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Game details saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: editedTitle })).toBeVisible();

  await page.getByTitle("Like").click();
  await expect(page.getByTitle("Like")).toHaveClass(/text-rose-700/);
  await page.getByTitle("Favorite").click();
  await expect(page.getByTitle("Favorite")).toHaveClass(/text-amber-700/);

  await page
    .getByLabel("Regenerate prompt")
    .fill(
      "Create version two with faster obstacles, clearer scoring, and a teal HUD.",
    );
  await page.getByRole("button", { name: "Regenerate" }).click();
  await expect(page).toHaveURL(/\/create\?jobId=/);
  await expect(page.getByText("Generated artifact")).toBeVisible({
    timeout: 60_000,
  });

  await page.goto(`/games/${gameId}`);
  await expect(page.getByText("Compared with v1")).toBeVisible();
  await expect(
    page.getByText(/Changed:|No file hash changes/).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore" }).last().click();
  await expect(page.getByText("Version restored.")).toBeVisible();

  await page.screenshot({
    path: path.join(screenshotDir, "social-details.png"),
    fullPage: true,
  });
});
