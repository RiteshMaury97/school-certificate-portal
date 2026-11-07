import { NextResponse } from "next/server";
import { z } from "zod";

import { adminAppCheck, describeAppCheckMintError } from "@/server/firebase-admin";
import { requesterIp } from "@/server/request-origin";
import { sameOrigin } from "@/server/security";
import { checkTurnstileToken } from "@/server/turnstile";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ turnstileToken: z.string().trim().min(1).max(4096) });
const TOKEN_TTL_MILLIS = 60 * 60 * 1000;

type FailureStage =
  | "origin"
  | "bad-request"
  | "turnstile-rejected"
  | "turnstile-unavailable"
  | "not-configured"
  | "mint-failed";

/** The stage is a fixed label (never a secret or raw error) so the browser console can show it. */
function failure(stage: FailureStage, error: string, status: number) {
  return NextResponse.json({ error, stage }, { status, headers: { "Cache-Control": "no-store" } });
}

/** Web app IDs look like 1:123456789012:web:0123456789abcdef. */
const WEB_APP_ID_PATTERN = /^\d+:\d+:web:[0-9a-f]+$/i;

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return failure("origin", "Invalid origin.", 403);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return failure("bad-request", "Security verification failed.", 400);

  const verification = await checkTurnstileToken(
    parsed.data.turnstileToken,
    requesterIp(request),
    process.env.APPCHECK_TURNSTILE_SECRET_KEY,
  );
  if (!verification.ok) {
    console.error("appCheck/token-turnstile", verification.reason, verification.errorCodes.join(","));
    if (verification.reason === "not-configured")
      return failure("not-configured", "Security verification is unavailable.", 503);
    if (verification.reason === "unavailable")
      return failure("turnstile-unavailable", "Security verification is unavailable.", 503);
    return failure("turnstile-rejected", "Security verification failed.", 403);
  }

  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
  if (!appId) {
    console.error("appCheck/token-not-configured | HINT: NEXT_PUBLIC_FIREBASE_APP_ID is not set.");
    return failure("not-configured", "Security verification is unavailable.", 503);
  }
  if (!WEB_APP_ID_PATTERN.test(appId)) {
    console.error(
      "appCheck/token-not-configured | HINT: NEXT_PUBLIC_FIREBASE_APP_ID is not a Web app ID (expected 1:<project number>:web:<id>).",
    );
    return failure("not-configured", "Security verification is unavailable.", 503);
  }
  try {
    const issued = await adminAppCheck.createToken(appId, { ttlMillis: TOKEN_TTL_MILLIS });
    return NextResponse.json(
      { token: issued.token, expireTimeMillis: Date.now() + issued.ttlMillis },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("appCheck/token-mint-failed", describeAppCheckMintError(error));
    return failure("mint-failed", "Security verification is unavailable.", 503);
  }
}
