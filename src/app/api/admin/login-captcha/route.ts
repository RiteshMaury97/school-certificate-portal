import { NextResponse } from "next/server";
import { z } from "zod";

import { requesterIp } from "@/server/request-origin";
import { sameOrigin, verifyRequestAppCheck } from "@/server/security";
import { verifyTurnstileToken } from "@/server/turnstile";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ token: z.string().trim().max(4096) });

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    await verifyRequestAppCheck(request);
    const ip = requesterIp(request);
    if (!ip)
      return NextResponse.json(
        { error: "Client network information is unavailable." },
        { status: 503 },
      );

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Complete the security check and try again." },
        { status: 400 },
      );
    if (!(await verifyTurnstileToken(parsed.data.token, ip)))
      return NextResponse.json(
        { error: "Security verification failed. Please complete the check again." },
        { status: 400 },
      );
    return NextResponse.json({ verified: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin/login-captcha POST]", message.replace(/[\r\n]/g, " ").slice(0, 180));
    return NextResponse.json(
      { error: "Security verification is unavailable. Please try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
