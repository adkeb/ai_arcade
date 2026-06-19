import ts from "typescript";
import type { GameSourceFiles, SafetyReview } from "../types";

const MAX_FILE_LENGTH = 150_000;
const MIN_TIMER_INTERVAL_MS = 16;
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

function expressionName(node: ts.Expression): string {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) {
    return `${expressionName(node.expression)}.${node.name.text}`;
  }
  return node.getText();
}

function isTrueLiteral(node: ts.Expression): boolean {
  return node.kind === ts.SyntaxKind.TrueKeyword;
}

function numericLiteralValue(node: ts.Expression | undefined): number | null {
  if (!node) return null;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text);
  }
  return null;
}

function astFindings(files: GameSourceFiles): string[] {
  const source = ts.createSourceFile(
    "game.js",
    files.gameJs,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.JS,
  );
  const findings = new Set<string>();

  function visit(node: ts.Node) {
    if (ts.isWhileStatement(node) && isTrueLiteral(node.expression)) {
      findings.add(
        "Blocked generated code capability: AST unbounded while loop",
      );
    }
    if (ts.isDoStatement(node) && isTrueLiteral(node.expression)) {
      findings.add("Blocked generated code capability: AST unbounded do loop");
    }
    if (ts.isForStatement(node) && !node.condition) {
      findings.add("Blocked generated code capability: AST unbounded for loop");
    }

    if (ts.isCallExpression(node)) {
      const callee = expressionName(node.expression);
      if (callee === "setTimeout" || callee === "setInterval") {
        if (node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
          findings.add(
            "Blocked generated code capability: AST string timer execution",
          );
        }
        const delay = numericLiteralValue(node.arguments[1]);
        if (
          callee === "setInterval" &&
          delay !== null &&
          delay < MIN_TIMER_INTERVAL_MS
        ) {
          findings.add(
            "Blocked generated code capability: AST high-frequency timer",
          );
        }
      }
      if (callee === "globalThis.eval" || callee.endsWith(".constructor")) {
        findings.add(
          "Blocked generated code capability: AST dynamic code execution",
        );
      }
    }

    if (ts.isNewExpression(node)) {
      const callee = expressionName(node.expression);
      if (
        callee === "Function" ||
        callee === "Worker" ||
        callee === "SharedWorker" ||
        callee === "WebSocket"
      ) {
        findings.add(
          `Blocked generated code capability: AST constructor ${callee}`,
        );
      }
    }

    if (ts.isPropertyAccessExpression(node)) {
      const path = expressionName(node);
      if (
        path === "document.cookie" ||
        path === "document.domain" ||
        path === "document.write" ||
        path === "navigator.serviceWorker" ||
        path === "navigator.clipboard" ||
        path === "navigator.credentials" ||
        path === "navigator.geolocation" ||
        path === "window.top" ||
        path === "globalThis.top" ||
        path === "window.parent" ||
        path === "parent.location" ||
        path === "top.location" ||
        path === "opener.location"
      ) {
        findings.add(`Blocked generated code capability: AST access ${path}`);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return Array.from(findings);
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
    ...astFindings(files),
  ];

  return {
    passed: findings.length === 0,
    findings,
    files,
  };
}
