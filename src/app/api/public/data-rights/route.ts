import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import {
  hashRequesterIp,
  verifyRequestAppCheck,
  writeAuditLog,
} from "@/server/security";
import { isAllowedRequestOrigin } from "@/shared/origin-policy";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const requestSchema = z.object({
  requestType: z.enum(["access", "correction", "erasure", "withdraw_consent"]),
  requesterName: z.string().trim().min(2).max(100),
  contactEmail: z.email().trim().max(254),
  studentName: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(1500),
  guardianConfirmation: z.literal(true),
});
export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    if (
      !isAllowedRequestOrigin(
        request.headers.get("origin"),
        process.env.APP_ORIGIN ?? request.nextUrl.origin,
        process.env.NODE_ENV !== "production",
      )
    )
      return NextResponse.json(
        { error: "Request could not be submitted." },
        { status: 403 },
      );
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Please check the request details." },
        { status: 400 },
      );
    const id = `SIS-${new Date().getUTCFullYear().toString()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    await db
      .collection("dataRightsRequests")
      .doc(id)
      .create({
        ...parsed.data,
        acknowledgmentId: id,
        status: "open",
        policyVersion: process.env.PRIVACY_POLICY_VERSION ?? "2026-10",
        ipHash: hashRequesterIp(request),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    await writeAuditLog(request, "public", "data_rights.request", id);
    const schoolName = process.env.GMAIL_FROM_NAME?.trim() ?? "Satyam International School";
    const emailConfirmationSent = await sendMail({
      to: parsed.data.contactEmail,
      subject: `${schoolName}: privacy request received (${id})`,
      text: `${schoolName} has received your ${parsed.data.requestType} data rights request.\n\nAcknowledgment: ${id}\n\nYour request details:\n${parsed.data.description}\n\nKeep this acknowledgment for follow-up. We will contact you if we need to verify your identity or clarify the request.`,
    }).then(() => true).catch((error: unknown) => {
      console.error("[public/data-rights] confirmation email failed", error);
      return false;
    });
    return NextResponse.json(
      { ok: true, acknowledgmentId: id, emailConfirmationSent },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error: "The request could not be submitted. Please contact the school.",
      },
      { status: 500 },
    );
  }
}
