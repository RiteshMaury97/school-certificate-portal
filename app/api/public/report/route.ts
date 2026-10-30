import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/src/lib/firebase-admin";
import {
  consumeSearchBudget,
  hashRequesterIp,
  verifyRequestAppCheck,
  writeAuditLog,
} from "@/src/lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  name: z.string().trim().min(2).max(100),
  session: z.string().regex(/^\d{4}-\d{2}$/),
  issue: z.string().trim().min(10).max(2000),
  contact: z.string().trim().min(5).max(254),
  consent: z.literal(true),
  turnstileToken: z.string().min(10).max(4096),
});
async function verifyTurnstile(token: string, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
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
        { error: "Please try again later." },
        { status: 429 },
      );
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Please check the report details." },
        { status: 400 },
      );
    const ip = request.headers.get("cf-connecting-ip") ?? "";
    if (!(await verifyTurnstile(parsed.data.turnstileToken, ip)))
      return NextResponse.json(
        { error: "Security verification failed." },
        { status: 400 },
      );
    const referenceId = `SIS-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const { turnstileToken: _turnstileToken, ...report } = parsed.data;
    await db
      .collection("recordReports")
      .doc(referenceId)
      .create({
        ...report,
        ipHash: hashRequesterIp(request),
        status: "open",
        createdAt: FieldValue.serverTimestamp(),
      });
    await writeAuditLog(
      request,
      "public",
      "record_report.created",
      referenceId,
    ).catch(() => undefined);
    return NextResponse.json(
      { ok: true, referenceId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to submit your report right now." },
      { status: 400 },
    );
  }
}
