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
    .regex(/^SIS-\d{4}-[A-F0-9]{8,24}$/),
  turnstileToken: z.string().min(10).max(4096),
});

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  try {
    const form = new URLSearchParams({ secret, response: token, remoteip: ip });
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const result: unknown = await response.json();
    return (
      response.ok &&
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
        { error: "Too many status checks. Try again later." },
        { status: 429 },
      );
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Enter a valid report reference and complete the security check." },
        { status: 400 },
      );
    const ip = requesterIp(request);
    if (!ip || !(await verifyTurnstile(parsed.data.turnstileToken, ip)))
      return NextResponse.json({ error: "Security verification failed." }, { status: 400 });
    const report = await db.collection("recordReports").doc(parsed.data.referenceId).get();
    if (!report.exists)
      return NextResponse.json(
        { error: "No report was found for that reference." },
        { status: 404 },
      );
    const savedStatus = String(report.get("status") ?? "open");
    const status =
      savedStatus === "reviewing"
        ? "in_review"
        : savedStatus === "resolved" || savedStatus === "rejected"
          ? "resolved"
          : "received";
    return NextResponse.json(
      { referenceId: parsed.data.referenceId, status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to check report status right now." },
      { status: 400 },
    );
  }
}
