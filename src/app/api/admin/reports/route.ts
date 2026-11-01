import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/firebase-admin";
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
  status: z.enum(["open", "reviewing", "resolved", "rejected"]),
  adminNote: z.string().trim().max(2000).default(""),
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

    await reference.update({
      status: parsed.data.status,
      adminNote: parsed.data.adminNote,
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeAuditLog(request, admin.uid, "record_report.updated", parsed.data.id);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
