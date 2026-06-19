import { NextResponse } from "next/server";
import type { ApiFailure, ApiSuccess } from "@ai-arcade/shared";

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(code: string, message: string, status = 400): NextResponse<ApiFailure> {
  return NextResponse.json(
    {
      ok: false,
      error: { code, message }
    },
    { status }
  );
}

export function parseError(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error";
}
