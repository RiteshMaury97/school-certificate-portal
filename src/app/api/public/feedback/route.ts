import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/firebase-admin";
import { requesterIp } from "@/server/request-origin";
import { hashRequesterIp } from "@/server/security";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  helpful: z.boolean(),
  comment: z.string().max(200).optional().default(""),
  page: z.enum(["/"]),
  turnstileToken: z.string().min(10).max(4096),
});
async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (remoteIp) body.set("remoteip", remoteIp);
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
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
async function consumeFeedbackBudget(ipHash: string): Promise<boolean> {
  const now = Date.now();
  const ref = db
    .collection("abuseCounters")
    .doc(`feedback_${ipHash}_${Math.floor(now / 3_600_000)}`);
  return db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    const count = Number(current.get("count") ?? 0);
    if (count >= 5) return false;
    tx.set(
      ref,
      {
        count: count + 1,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(now + 2 * 3_600_000),
      },
      { merge: true },
    );
    return true;
  });
}
export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Please check your feedback." },
        { status: 400 },
      );
    const ipHash = hashRequesterIp(request);
    if (!(await consumeFeedbackBudget(ipHash)))
      return NextResponse.json(
        { error: "Feedback limit reached. Please try again later." },
        { status: 429 },
      );
    if (
      !(await verifyTurnstile(
        parsed.data.turnstileToken,
        requesterIp(request),
      ))
    )
      return NextResponse.json(
        { error: "Security verification failed." },
        { status: 400 },
      );
    const comment = parsed.data.helpful
      ? ""
      : parsed.data.comment
          .replace(/<[^>]*>/g, "")
          .replace(/[<>\u0000-\u001f\u007f]/g, " ")
          .trim()
          .slice(0, 200);
    await db
      .collection("feedback")
      .add({
        helpful: parsed.data.helpful,
        comment,
        timestamp: FieldValue.serverTimestamp(),
        page: parsed.data.page,
      });
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to submit feedback right now." },
      { status: 503 },
    );
  }
}
