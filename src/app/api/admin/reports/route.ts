import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { apiError, requireRoles, writeAuditLog } from "@/server/security";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeDate(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return "";
}

export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["approver", "admin", "superadmin"]);
    const snapshot = await db.collection("recordReports").orderBy("createdAt", "desc").limit(200).get();
    return NextResponse.json(
      {
        reports: snapshot.docs.map((document) => {
          const data = document.data();
          return {
            id: document.id,
            ...data,
            createdAt: serializeDate(data.createdAt),
            updatedAt: serializeDate(data.updatedAt),
          };
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

const updateSchema = z.object({
  id: z.string().trim().min(1).max(128),
  status: z.enum(["open", "reviewing", "resolved", "rejected"]).optional(),
  adminNote: z.string().trim().max(2000).default(""),
  reply: z.string().trim().min(1).max(3000).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["approver", "admin", "superadmin"]);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Provide a valid report status and staff note." }, { status: 400 });

    const reference = db.collection("recordReports").doc(parsed.data.id);
    const existing = await reference.get();
    if (!existing.exists) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    if (!parsed.data.status && !parsed.data.reply)
      return NextResponse.json({ error: "Provide a status update or an email response." }, { status: 400 });
    if (parsed.data.reply) {
      const contactMethod = String(existing.get("contactMethod") ?? "email");
      const recipient = String(existing.get("email") ?? (contactMethod === "email" ? existing.get("contact") : "") ?? "").trim();
      if (!recipient) return NextResponse.json({ error: "This report has no email contact. Ask the reporter to choose email follow-up." }, { status: 400 });
      const schoolName = process.env.GMAIL_FROM_NAME?.trim() || "Satyam International School";
      await sendMail({
        to: recipient,
        replyTo: admin.email,
        subject: `${schoolName}: response to report ${parsed.data.id}`,
        text: `${schoolName} has responded to your wrong-record report.\n\nReference: ${parsed.data.id}\n\n${parsed.data.reply.trim()}\n\nYou can reply directly to this email to continue the conversation.`,
      });
    }
    await reference.update({
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(parsed.data.status ? { adminNote: parsed.data.adminNote } : {}),
      ...(parsed.data.reply ? {
        lastAdminResponse: parsed.data.reply.trim(),
        lastAdminResponseAt: FieldValue.serverTimestamp(),
        lastAdminResponseBy: admin.uid,
      } : {}),
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeAuditLog(request, admin.uid, parsed.data.reply ? "record_report.responded" : "record_report.updated", parsed.data.id);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
