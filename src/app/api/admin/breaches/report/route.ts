import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
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

    const admins = await db
      .collection("admins")
      .where("role", "==", "superadmin")
      .where("status", "==", "active")
      .get();
    const recipients = [
      ...new Set(admins.docs.map((doc) => String(doc.get("email") ?? "").trim()).filter(Boolean)),
    ];
    if (recipients.length) {
      const schoolName = process.env.GMAIL_FROM_NAME?.trim() ?? "School portal";
      await sendMail({
        to: recipients,
        subject: `${schoolName}: suspected personal data incident reported`,
        text: `A suspected personal data incident was reported by an administrator.\n\nReference: ${ref.id}\nTitle: ${data.title}\nDiscovered at: ${data.discoveredAt}\nHow discovered: ${data.howDiscovered}\n\nSummary:\n${data.summary}\n\nReview the incident in the administrator breach register.`,
      });
    }
    return NextResponse.json({ id: ref.id, status: "reported" }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
