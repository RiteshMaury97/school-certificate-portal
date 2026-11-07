import { NextResponse } from "next/server";
import { z } from "zod";

import { adminAppCheck } from "@/server/firebase-admin";
import { requesterIp } from "@/server/request-origin";
import { sameOrigin } from "@/server/security";
import { verifyTurnstileToken } from "@/server/turnstile";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ turnstileToken: z.string().trim().min(1).max(4096) });
const TOKEN_TTL_MILLIS = 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Security verification failed." }, { status: 400 });
  const ip = requesterIp(request);
  if (!(await verifyTurnstileToken(parsed.data.turnstileToken, ip)))
    return NextResponse.json({ error: "Security verification failed." }, { status: 403 });

  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
  if (!appId) return NextResponse.json({ error: "App Check is not configured." }, { status: 503 });
  try {
    const issued = await adminAppCheck.createToken(appId, { ttlMillis: TOKEN_TTL_MILLIS });
    return NextResponse.json(
      { token: issued.token, expireTimeMillis: Date.now() + issued.ttlMillis },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("appCheck/token-mint-failed");
    return NextResponse.json({ error: "Security verification is unavailable." }, { status: 503 });
  }
}
