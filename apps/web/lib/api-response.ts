import { NextResponse } from "next/server";
import type { ApiFailure, ApiSuccess } from "@ai-arcade/shared";

type ZodIssueLike = {
  path?: Array<string | number>;
  message?: string;
};

type ValidationFailure = {
  code: string;
  message: string;
};

export function ok<T>(
  data: T,
  init?: ResponseInit,
): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(
  code: string,
  message: string,
  status = 400,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message },
    },
    { status },
  );
}

function zodIssues(error: unknown): ZodIssueLike[] | null {
  if (!error || typeof error !== "object" || !("issues" in error)) return null;
  const issues = (error as { issues?: unknown }).issues;
  return Array.isArray(issues) ? (issues as ZodIssueLike[]) : null;
}

export function validationFailureFor(
  error: unknown,
  failuresByField: Record<string, ValidationFailure>,
  fallback: ValidationFailure = {
    code: "INVALID_REQUEST",
    message: "Request payload failed validation.",
  },
): ValidationFailure | null {
  const issues = zodIssues(error);
  if (!issues) return null;

  for (const issue of issues) {
    const path = (issue.path ?? []).map(String);
    const exactField = path.join(".");
    const topLevelField = path[0] ?? "";
    if (exactField && failuresByField[exactField])
      return failuresByField[exactField];
    if (topLevelField && failuresByField[topLevelField])
      return failuresByField[topLevelField];
  }

  return fallback;
}

export function parseError(error: unknown): string {
  if (zodIssues(error)) return "Request payload failed validation.";
  return error instanceof Error ? error.message : "Unexpected server error";
}
