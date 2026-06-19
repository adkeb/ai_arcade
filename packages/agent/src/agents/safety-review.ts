import type { GameSourceFiles, SafetyReview } from "../types";

const MAX_FILE_LENGTH = 150_000;
const requiredCspParts = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
];

const blockedPatterns: Array<{ label: string; regex: RegExp }> = [
  { label: "eval", regex: /\beval\s*\(/i },
  { label: "new Function", regex: /new\s+Function/i },
  { label: "Function constructor alias", regex: /\.constructor\s*\(/i },
  { label: "document.cookie", regex: /document\.cookie/i },
  { label: "document.domain", regex: /document\.domain/i },
  { label: "document.write", regex: /document\.write/i },
  { label: "localStorage", regex: /\blocalStorage\b/i },
  { label: "sessionStorage", regex: /\bsessionStorage\b/i },
  { label: "indexedDB", regex: /\bindexedDB\b/i },
  { label: "Cache API", regex: /\bcaches\b/i },
  { label: "external script src", regex: /<script[^>]+src=["']https?:/i },
  { label: "external stylesheet", regex: /<link[^>]+href=["']https?:/i },
  { label: "external fetch", regex: /\bfetch\s*\(\s*["']https?:/i },
  { label: "dynamic import", regex: /\bimport\s*\(/i },
  { label: "WebSocket", regex: /\bWebSocket\b/i },
  {
    label: "Worker",
    regex: /\b(?:SharedWorker|Worker)\s*\(|\bimportScripts\s*\(/i,
  },
  { label: "service worker", regex: /navigator\.serviceWorker/i },
  { label: "navigator.credentials", regex: /navigator\.credentials/i },
  { label: "clipboard", regex: /navigator\.clipboard/i },
  { label: "window.top", regex: /window\.top/i },
  { label: "window.parent", regex: /window\.parent/i },
  { label: "parent navigation", regex: /\bparent\.location\b/i },
  { label: "top navigation", regex: /\btop\.location\b/i },
  { label: "window.open", regex: /\bwindow\.open\s*\(/i },
  { label: "opener", regex: /\bopener\b/i },
  { label: "geolocation", regex: /navigator\.geolocation/i },
  { label: "camera or microphone", regex: /getUserMedia/i },
  { label: "inline script", regex: /<script\b(?![^>]*\bsrc=)[^>]*>/i },
  { label: "inline style tag", regex: /<style\b/i },
  { label: "inline event handler", regex: /<[a-z][^>]*\son[a-z]+\s*=/i },
  { label: "inline style attribute", regex: /<[a-z][^>]*\sstyle\s*=/i },
  { label: "form element", regex: /<form\b/i },
  { label: "embedded frame/object", regex: /<(?:iframe|object|embed|base)\b/i },
  { label: "meta refresh", regex: /<meta[^>]+http-equiv=["']refresh["']/i },
];

function extractCsp(indexHtml: string): string {
  const metas = indexHtml.match(/<meta\b[^>]*>/gi) ?? [];
  const cspMeta = metas.find((meta) =>
    /http-equiv=["']content-security-policy["']/i.test(meta),
  );
  return cspMeta?.match(/\bcontent=(["'])(.*?)\1/i)?.[2] ?? "";
}

function cspFindings(indexHtml: string): string[] {
  const csp = extractCsp(indexHtml);
  if (!csp) return ["Blocked generated code capability: missing CSP meta"];
  const findings: string[] = [];
  if (/unsafe-inline|unsafe-eval/i.test(csp)) {
    findings.push("Blocked generated code capability: unsafe CSP directive");
  }
  for (const part of requiredCspParts) {
    if (!csp.includes(part)) {
      findings.push(
        `Blocked generated code capability: weak CSP missing ${part}`,
      );
    }
  }
  return findings;
}

function sizeFindings(files: GameSourceFiles): string[] {
  return Object.entries(files)
    .filter(([, body]) => body.length > MAX_FILE_LENGTH)
    .map(
      ([path]) =>
        `Blocked generated code capability: ${path} exceeds source size limit`,
    );
}

export async function runSafetyReviewAgent(
  files: GameSourceFiles,
): Promise<SafetyReview> {
  const joined = [files.indexHtml, files.gameJs, files.styleCss].join("\n");
  const findings = [
    ...sizeFindings(files),
    ...cspFindings(files.indexHtml),
    ...blockedPatterns
      .filter((pattern) => pattern.regex.test(joined))
      .map((pattern) => `Blocked generated code capability: ${pattern.label}`),
  ];

  return {
    passed: findings.length === 0,
    findings,
    files,
  };
}
