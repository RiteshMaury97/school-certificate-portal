import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/firebase-admin";
import { apiError, requireRoles, writeAuditLog } from "@/server/security";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function serializeDate(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return "";
}

export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["approver", "admin"]);
    const snapshot = await db
      .collection("contactEnquiries")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    return NextResponse.json(
      {
        enquiries: snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
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
  id: z.string().min(1).max(128),
  status: z.enum(["open", "reviewing", "resolved", "closed"]),
  adminNote: z.string().trim().max(2000).default(""),
});

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["approver", "admin"]);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Provide a valid enquiry, status and staff note." },
        { status: 400 },
      );
    const ref = db.collection("contactEnquiries").doc(parsed.data.id);
    const existing = await ref.get();
    if (!existing.exists)
      return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
    await ref.update({
      status: parsed.data.status,
      adminNote: parsed.data.adminNote,
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeAuditLog(request, admin.uid, "contact_enquiry.updated", parsed.data.id);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
