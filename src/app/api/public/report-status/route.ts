import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/firebase-admin";
import { requesterIp } from "@/server/request-origin";
import { consumeSearchBudget, verifyRequestAppCheck } from "@/server/security";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  referenceId: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => {
      if (!value.startsWith("SIS-") || value.length < 17 || value[8] !== "-") return false;
      const year = value.slice(4, 8);
      const suffix = value.slice(9);
      return (
        /^[0-9]{4}$/.test(year) &&
        (suffix.length === 8 || suffix.length === 32) &&
        /^[0-9A-F]+$/.test(suffix)
      );
    }),
  turnstileToken: z.string().min(10).max(4096),
});

async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const result: unknown = await response.json();
    return (
      typeof result === "object" &&
      result !== null &&
      "success" in result &&
      result.success === true
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    if (!(await consumeSearchBudget(request)))
      return NextResponse.json(
        { error: "Too many status checks. Please try again later." },
        { status: 429, headers: { "Cache-Control": "no-store" } },
      );
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return NextResponse.json(
        { error: "Enter a valid report reference and complete the security check." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    if (!(await verifyTurnstile(parsed.data.turnstileToken, requesterIp(request))))
      return NextResponse.json(
        { error: "Security verification failed. Please try again." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    const report = await db.collection("recordReports").doc(parsed.data.referenceId).get();
    if (!report.exists)
      return NextResponse.json(
        { error: "No report was found for that reference." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    const rawStatus = String(report.get("status") ?? "open");
    const status =
      rawStatus === "reviewing"
        ? "in_review"
        : rawStatus === "resolved" || rawStatus === "rejected"
          ? "resolved"
          : "received";
    return NextResponse.json(
      { status },
      { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to check report status right now." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
