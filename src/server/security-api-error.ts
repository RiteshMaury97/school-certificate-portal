import { NextResponse } from "next/server";

import { describeFirebaseError } from "./firebase-admin";
import { ADMIN_HARD_SESSION_LIMIT_MS } from "../shared/session-policy";

const invalidSessionCodes = new Set([
  "auth/argument-error",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/invalid-id-token",
  "auth/invalid-session-cookie",
  "auth/session-cookie-expired",
  "auth/session-cookie-revoked",
  "auth/user-disabled",
  "auth/user-not-found",
]);

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: Math.floor(ADMIN_HARD_SESSION_LIMIT_MS / 1000),
  };
}

export function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: Math.floor(ADMIN_HARD_SESSION_LIMIT_MS / 1000),
  };
}

export function apiError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message === "UNAUTHORIZED" || invalidSessionCodes.has(errorCode(error))) {
    const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
    response.cookies.set("sis_admin_session", "", {
      ...adminSessionCookieOptions(),
      maxAge: 0,
    });
    response.cookies.set("sis_admin_csrf", "", {
      ...csrfCookieOptions(),
      maxAge: 0,
    });
    return response;
  }
  const response = knownApiError(message);
  if (response) return response;
  console.error("[Admin API request failed]", describeFirebaseError(error));
  return NextResponse.json(
    {
      error:
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.message
          : "The request could not be completed",
    },
    { status: 500 },
  );
}

function errorCode(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) return "";
  const code: unknown = error.code;
  return typeof code === "string" || typeof code === "number" ? String(code) : "";
}

function knownApiError(message: string): NextResponse | null {
  switch (message) {
    case "REAUTH_REQUIRED":
      return NextResponse.json(
        { error: "Re-authentication with password and email code is required." },
        { status: 428 },
      );
    case "FORBIDDEN":
      return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
    case "CSRF":
      return NextResponse.json({ error: "CSRF validation failed" }, { status: 403 });
    case "APP_CHECK":
      return NextResponse.json({ error: "App verification failed" }, { status: 403 });
    case "ERASURE_STORAGE_RECONCILIATION_REQUIRED":
      return NextResponse.json(
        {
          error:
            "Legacy R2 objects need manual ownership reconciliation before erasure can be confirmed. No other student's objects were deleted.",
        },
        { status: 409 },
      );
    case "ERASURE_JOB_NOT_RETRYABLE":
      return NextResponse.json(
        { error: "This erasure job is not in a retryable state." },
        { status: 409 },
      );
    case "STUDENT_NOT_FOUND":
      return NextResponse.json({ error: "Student record not found." }, { status: 404 });
    case "ERASURE_LEGAL_HOLD":
      return NextResponse.json(
        {
          error:
            "A legal or statutory retention hold prevents erasure. The School must review the obligation before proceeding.",
        },
        { status: 409 },
      );
    default:
      if (message.startsWith("UPLOAD_QUOTA:"))
        return NextResponse.json(
          { error: message.slice("UPLOAD_QUOTA:".length) },
          { status: 429 },
        );
      return null;
  }
}
