import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/firebase-admin";
import { requesterIp } from "@/server/request-origin";
import {
  consumeSearchBudget,
  hashRequesterIp,
  verifyRequestAppCheck,
  writeAuditLog,
} from "@/server/security";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  fullName: z.string().trim().min(2).max(100),
  mobile: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^[+\d() .-]+$/),
  email: z.email().trim().max(254),
  enquiryType: z.enum(["certificate", "student-record", "admission", "general", "other"]),
  studentName: z.string().trim().max(100).optional().default(""),
  classSession: z.string().trim().max(80).optional().default(""),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(3000),
  consent: z.literal(true),
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
        { error: "Please wait a little before sending another enquiry." },
        { status: 429 },
      );
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Check the required contact form fields and try again." },
        { status: 400 },
      );
    if (!(await verifyTurnstile(parsed.data.turnstileToken, requesterIp(request))))
      return NextResponse.json(
        { error: "Security verification failed. Please complete the check again." },
        { status: 400 },
      );

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
    return NextResponse.json(
      { ok: true, referenceId: record.id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to submit your enquiry right now. Please contact the school office." },
      { status: 503 },
    );
  }
}
