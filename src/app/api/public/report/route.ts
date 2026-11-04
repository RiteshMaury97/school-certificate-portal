import { randomBytes } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { requesterIp } from "@/server/request-origin";
import {
  consumeSearchBudget,
  hashRequesterIp,
  verifyRequestAppCheck,
  writeAuditLog,
} from "@/server/security";
import { wrongRecordReportSchema } from "@/shared/validation";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
    const parsed = wrongRecordReportSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Please check the report details." },
        { status: 400 },
      );
    const ip = requesterIp(request) ?? "";
    if (!(await verifyTurnstile(parsed.data.turnstileToken, ip)))
      return NextResponse.json(
        { error: "Security verification failed." },
        { status: 400 },
      );
    const referenceId = `SIS-${new Date().getFullYear().toString()}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const report = { ...parsed.data };
    Reflect.deleteProperty(report, "turnstileToken");
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
    ).catch(() => null);
    const schoolName = process.env.GMAIL_FROM_NAME?.trim() ?? "Satyam International School";
    const emailCopySent = await sendMail({
      to: parsed.data.email,
      subject: `${schoolName}: copy of wrong-record report ${referenceId}`,
      text: `${schoolName} has received your wrong-record report.\n\nReference: ${referenceId}\nStudent: ${parsed.data.name}\nPassing session: ${parsed.data.session}\n\nYour reported issue:\n${parsed.data.issue}\n\nPreferred contact: ${parsed.data.contactMethod} (${parsed.data.contact})\n\nKeep this reference to check your report status.`,
    }).then(() => true).catch((error: unknown) => {
      console.error("[public/report] confirmation email failed", error);
      return false;
    });
    return NextResponse.json(
      { ok: true, referenceId, emailCopySent },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to submit your report right now." },
      { status: 400 },
    );
  }
}
