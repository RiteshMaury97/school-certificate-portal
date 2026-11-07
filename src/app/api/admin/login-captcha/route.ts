import { NextResponse } from "next/server";
import { z } from "zod";

import { requesterIp } from "@/server/request-origin";
import { sameOrigin, verifyRequestAppCheck } from "@/server/security";
import { verifyTurnstileToken } from "@/server/turnstile";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ token: z.string().trim().min(1).max(4096) });

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    await verifyRequestAppCheck(request);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Complete the security check and try again." },
        { status: 400 },
      );
    if (!(await verifyTurnstileToken(parsed.data.token, requesterIp(request))))
      return NextResponse.json(
        { error: "Security verification failed. Please complete the check again." },
        { status: 400 },
      );
    return NextResponse.json({ verified: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("admin/login-captcha/unavailable");
    return NextResponse.json(
      { error: "Security verification is unavailable. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
