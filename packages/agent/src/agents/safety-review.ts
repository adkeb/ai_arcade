import type { GameSourceFiles, SafetyReview } from "../types";

const blockedPatterns: Array<{ label: string; regex: RegExp }> = [
  { label: "eval", regex: /\beval\s*\(/i },
  { label: "new Function", regex: /new\s+Function/i },
  { label: "document.cookie", regex: /document\.cookie/i },
  { label: "localStorage", regex: /\blocalStorage\b/i },
  { label: "sessionStorage", regex: /\bsessionStorage\b/i },
  { label: "external script src", regex: /<script[^>]+src=["']https?:/i },
  { label: "external fetch", regex: /\bfetch\s*\(\s*["']https?:/i },
  { label: "WebSocket", regex: /\bWebSocket\b/i },
  { label: "navigator.credentials", regex: /navigator\.credentials/i },
  { label: "window.top", regex: /window\.top/i },
  { label: "geolocation", regex: /navigator\.geolocation/i },
  { label: "camera or microphone", regex: /getUserMedia/i }
];

export async function runSafetyReviewAgent(files: GameSourceFiles): Promise<SafetyReview> {
  const joined = [files.indexHtml, files.gameJs, files.styleCss].join("\n");
  const findings = blockedPatterns
    .filter((pattern) => pattern.regex.test(joined))
    .map((pattern) => `Blocked generated code capability: ${pattern.label}`);

  return {
    passed: findings.length === 0,
    findings,
    files
  };
}
