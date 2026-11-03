import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { apiError, requireRoles, writeAuditLog } from "@/server/security";

import type { DocumentSnapshot } from "firebase-admin/firestore";
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
    await requireRoles(request, ["approver", "superadmin"]);
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

type ReportUpdate = z.infer<typeof updateSchema>;

async function emailReportReply(
  data: ReportUpdate,
  existing: DocumentSnapshot,
  adminEmail: string,
): Promise<NextResponse | null> {
  if (!data.reply) return null;
  const contactMethod = String(existing.get("contactMethod") ?? "email");
  const recipient = String(existing.get("email") ?? (contactMethod === "email" ? existing.get("contact") : "") ?? "").trim();
  if (!recipient) return NextResponse.json({ error: "This report has no email contact. Ask the reporter to choose email follow-up." }, { status: 400 });
  const schoolName = process.env.GMAIL_FROM_NAME?.trim() ?? "Satyam International School";
  await sendMail({
    to: recipient,
    replyTo: adminEmail,
    subject: `${schoolName}: response to report ${data.id}`,
    text: `${schoolName} has responded to your wrong-record report.\n\nReference: ${data.id}\n\n${data.reply.trim()}\n\nYou can reply directly to this email to continue the conversation.`,
  });
  return null;
}

async function applyReportUpdate(
  request: NextRequest,
  admin: Awaited<ReturnType<typeof requireRoles>>,
  data: ReportUpdate,
): Promise<NextResponse | null> {
  const reference = db.collection("recordReports").doc(data.id);
  const existing = await reference.get();
  if (!existing.exists) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (!data.status && !data.reply)
    return NextResponse.json({ error: "Provide a status update or an email response." }, { status: 400 });
  const emailError = await emailReportReply(data, existing, admin.email);
  if (emailError) return emailError;
  await reference.update({
    ...(data.status ? { status: data.status, adminNote: data.adminNote } : {}),
    ...(data.reply ? {
      lastAdminResponse: data.reply.trim(),
      lastAdminResponseAt: FieldValue.serverTimestamp(),
      lastAdminResponseBy: admin.uid,
    } : {}),
    updatedBy: admin.uid,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await writeAuditLog(request, admin.uid, data.reply ? "record_report.responded" : "record_report.updated", data.id);
  return null;
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["approver", "superadmin"]);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Provide a valid report status and staff note." }, { status: 400 });

    const result = await applyReportUpdate(request, admin, parsed.data);
    if (result) return result;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
