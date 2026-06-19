import assert from "node:assert/strict";
import test from "node:test";
import { runSafetyReviewAgent } from "@ai-arcade/agent/agents/safety-review";
import type { GameSourceFiles } from "@ai-arcade/agent/types";

const safeFiles: GameSourceFiles = {
  indexHtml:
    "<!doctype html><html><head><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; object-src 'none'\"><link rel=\"stylesheet\" href=\"./style.css\"></head><body><main><canvas id=\"game\"></canvas></main><script src=\"./game.js\" defer></script></body></html>",
  gameJs:
    "window.addEventListener('load', () => { function tick(){ requestAnimationFrame(tick); } requestAnimationFrame(tick); });",
  styleCss: "body{margin:0}canvas{display:block}",
};

test("SafetyReviewAgent passes a CSP-bound local game bundle", async () => {
  const review = await runSafetyReviewAgent(safeFiles);

  assert.equal(review.passed, true);
  assert.deepEqual(review.findings, []);
});

test("SafetyReviewAgent blocks AST-detected unbounded loops", async () => {
  const review = await runSafetyReviewAgent({
    ...safeFiles,
    gameJs: "window.addEventListener('load', () => { while (true) {} });",
  });

  assert.equal(review.passed, false);
  assert.match(review.findings.join("\n"), /AST unbounded while loop/);
});

test("SafetyReviewAgent blocks high-frequency timer loops", async () => {
  const review = await runSafetyReviewAgent({
    ...safeFiles,
    gameJs:
      "window.addEventListener('load', () => { setInterval(() => {}, 1); });",
  });

  assert.equal(review.passed, false);
  assert.match(review.findings.join("\n"), /AST high-frequency timer/);
});
