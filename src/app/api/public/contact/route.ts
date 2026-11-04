import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { requesterIp } from "@/server/request-origin";
import { consumeSearchBudget, hashRequesterIp, verifyRequestAppCheck, writeAuditLog } from "@/server/security";
import { contactEnquirySchema as schema } from "@/shared/validation";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return typeof result === "object" && result !== null && "success" in result && result.success === true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    if (!(await consumeSearchBudget(request)))
      return NextResponse.json({ error: "Please wait a little before sending another enquiry." }, { status: 429 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Check the required contact form fields and try again." }, { status: 400 });
    if (!(await verifyTurnstile(parsed.data.turnstileToken, requesterIp(request))))
      return NextResponse.json({ error: "Security verification failed. Please complete the check again." }, { status: 400 });

    const enquiry = parsed.data;
    const record = await db.collection("contactEnquiries").add({
      fullName: enquiry.fullName,
      mobile: enquiry.mobile,
      email: enquiry.email.toLowerCase(),
      enquiryType: enquiry.enquiryType,
      studentName: enquiry.studentName,
      classSession: enquiry.classSession,
      subject: enquiry.subject,
      message: enquiry.message,
      consent: enquiry.consent,
      ipHash: hashRequesterIp(request),
      status: "open",
      adminNote: "",
      createdAt: FieldValue.serverTimestamp(),
    });
    await writeAuditLog(request, "public", "contact_enquiry.created", record.id).catch(() => false);
    const schoolName = process.env.GMAIL_FROM_NAME?.trim() ?? "Satyam International School";
    const emailCopySent = await sendMail({
      to: enquiry.email,
      subject: `${schoolName}: copy of your enquiry (${record.id})`,
      text: `${schoolName} has received your enquiry.\n\nReference: ${record.id}\nSubject: ${enquiry.subject}\nType: ${enquiry.enquiryType}\n\nYour message:\n${enquiry.message}\n\nWe will respond to this email address.`,
    }).then(() => true).catch((error: unknown) => {
      console.error("[public/contact] confirmation email failed", error);
      return false;
    });
    return NextResponse.json({ ok: true, referenceId: record.id, emailCopySent }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to submit your enquiry right now. Please contact the school office." }, { status: 503 });
  }
}
