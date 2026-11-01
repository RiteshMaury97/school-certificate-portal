import { randomBytes } from "node:crypto";

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
  name: z.string().trim().min(2).max(100),
  session: z.string().regex(/^\d{4}-\d{2}$/),
  issue: z.string().trim().min(10).max(2000),
  contactEmail: z.union([z.email().trim().max(254), z.literal("")]).optional(),
  phoneNumber: z
    .string()
    .trim()
    .min(8)
    .max(24)
    .regex(/^\+?[0-9\s().-]{8,24}$/)
    .refine((value) => {
      const digits = value.replace(/\D/g, "");
      return digits.length >= 8 && digits.length <= 15;
    }, "Enter a valid phone number."),
  consent: z.literal(true),
  turnstileToken: z.string().min(10).max(4096),
});
async function verifyTurnstile(token: string, ip: string | null) {
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
    const result: unknown = await response.json();
    if (!response.ok || typeof result !== "object" || result === null || !("success" in result)) {
      console.error("Report Turnstile verification returned an invalid response.");
      return false;
    }
    if (result.success !== true) {
      const codes =
        "error-codes" in result && Array.isArray(result["error-codes"])
          ? result["error-codes"].filter((code): code is string => typeof code === "string")
          : [];
      console.error("Report Turnstile verification failed:", codes.join(", ") || "unknown error");
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    if (!(await consumeSearchBudget(request)))
      return NextResponse.json({ error: "Please try again later." }, { status: 429 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      const fieldLabels: Record<string, string> = {
        name: "Student name",
        session: "Passing session",
        issue: "What is wrong?",
        contactEmail: "Contact email",
        phoneNumber: "Phone number",
        consent: "Consent",
        turnstileToken: "Security verification",
      };
      const firstIssue = parsed.error.issues[0];
      const field = String(firstIssue?.path[0] ?? "");
      return NextResponse.json(
        {
          error: firstIssue
            ? `${fieldLabels[field] ?? "Report details"}: ${firstIssue.message}`
            : "Please check the report details.",
        },
        { status: 400 },
      );
    }
    const ip = requesterIp(request);
    if (!(await verifyTurnstile(parsed.data.turnstileToken, ip)))
      return NextResponse.json({ error: "Security verification failed." }, { status: 400 });
    const referenceId = `SIS-${new Date().getFullYear()}-${randomBytes(16).toString("hex").toUpperCase()}`;
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
    await writeAuditLog(request, "public", "record_report.created", referenceId).catch(() => {});
    return NextResponse.json(
      { ok: true, referenceId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Unable to submit your report right now." }, { status: 400 });
  }
}
