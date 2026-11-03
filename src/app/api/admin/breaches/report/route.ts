import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { sendImmediateBreachAlert } from "@/server/breach-alerts";
import { db } from "@/server/firebase-admin";
import { apiError, requireRoles, writeAuditLog } from "@/server/security";
import { suspectedBreachSchema } from "@/shared/breach-schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["uploader", "approver", "admin", "superadmin"]);
    const parsed = suspectedBreachSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Provide a title, summary, discovery date and discovery method." },
        { status: 400 },
      );
    const data = parsed.data;
    const ref = await db.collection("breaches").add({
      ...data,
      occurredAt: data.occurredAt ? new Date(data.occurredAt) : null,
      cause: data.cause ?? "other",
      dataCategories: data.dataCategories ?? [],
      severity: data.severity ?? "medium",
      involvesMinors: data.involvesMinors ?? false,
      systemsAffected: "",
      affectedPrincipalsEstimate: 0,
      containmentActions: "",
      likelyConsequences: "",
      incidentLead: admin.uid,
      status: "reported",
      boardNotifiedAt: null,
      boardDetailedReportAt: null,
      principalsNotifiedAt: null,
      closedAt: null,
      rootCause: "",
      correctiveActions: "",
      lessonsLearned: "",
      createdBy: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await ref.collection("updates").add({
      at: FieldValue.serverTimestamp(),
      byUid: admin.uid,
      note: "Suspected incident reported",
      statusChange: null,
    });
    await writeAuditLog(request, admin.uid, "breach.reported", ref.id, undefined, {
      changedFields: [
        "title",
        "summary",
        "discoveredAt",
        "occurredAt",
        "howDiscovered",
        "cause",
        "severity",
        "dataCategories",
        "involvesMinors",
      ],
    });

    await sendImmediateBreachAlert({ title: data.title, severity: data.severity ?? "medium" });
    await writeAuditLog(request, admin.uid, "breach.alert_sent", ref.id, undefined, {
      changedFields: ["immediate-superadmin-email"],
    });
    return NextResponse.json({ id: ref.id, status: "reported" }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
