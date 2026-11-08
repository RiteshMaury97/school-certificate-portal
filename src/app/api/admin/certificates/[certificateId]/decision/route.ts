import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { removeCertificateNumberIndex } from "@/server/certificate-index";
import { db } from "@/server/firebase-admin";
import { sendCertificateAvailableNotice } from "@/server/notifications";
import {
  adjustPublicSessions,
  ensurePublicSessions,
  rebuildPublicSessions,
} from "@/server/public-sessions";
import { apiError, requireRoles, writeAuditLog } from "@/server/security";
import { canReviewUpload } from "@/shared/role-policy";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DecisionInput = { decision: "approve" | "reject"; reason: string };

function decisionFields(
  value: unknown,
): { decision: string; reason: string; detailsMatch: boolean } | { error: string } {
  if (!value || typeof value !== "object" || !("decision" in value))
    return { error: "Choose approve or reject." };
  const decision = typeof value.decision === "string" ? value.decision : "";
  const reason = "reason" in value && typeof value.reason === "string" ? value.reason.trim() : "";
  const detailsMatch = "detailsMatch" in value && value.detailsMatch === true;
  return { decision, reason, detailsMatch };
}

function parseDecisionInput(value: unknown): DecisionInput | { error: string } {
  const fields = decisionFields(value);
  if ("error" in fields) return fields;
  const { decision, reason, detailsMatch } = fields;
  if (decision !== "approve" && decision !== "reject") return { error: "Invalid decision." };
  if (decision === "reject" && (reason.length < 10 || reason.length > 1000))
    return { error: "Enter a rejection reason of at least 10 characters." };
  if (decision === "approve" && !detailsMatch)
    return { error: "Confirm that the details match the document before approval." };
  return { decision, reason };
}

function decisionErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof Error)) return null;
  if (error.message === "NOT_FOUND")
    return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
  if (error.message === "NOT_PENDING")
    return NextResponse.json({ error: "This certificate is no longer pending." }, { status: 409 });
  if (error.message === "SELF_APPROVAL")
    return NextResponse.json(
      { error: "The uploader cannot approve or reject their own upload." },
      { status: 403 },
    );
  if (error.message === "REPLACED_CERTIFICATE_UNAVAILABLE")
    return NextResponse.json(
      { error: "The original published certificate is no longer eligible for replacement." },
      { status: 409 },
    );
  if (error.message === "UPLOADER_UNKNOWN")
    return NextResponse.json(
      { error: "Uploader identity is missing. Reconcile this legacy record before approval." },
      { status: 409 },
    );
  return null;
}

function assertReviewable(
  snap: FirebaseFirestore.DocumentSnapshot,
  actor: { uid: string; role: string },
  decision: DecisionInput["decision"],
): string {
  if (!snap.exists) throw new Error("NOT_FOUND");
  if (snap.get("status") !== "pending") throw new Error("NOT_PENDING");
  const uploaderUid = String(snap.get("uploadedBy") ?? "");
  if (!uploaderUid) throw new Error("UPLOADER_UNKNOWN");
  const privilegedSelfReview =
    actor.uid === uploaderUid && (actor.role === "admin" || actor.role === "superadmin");
  if (!canReviewUpload(actor.uid, uploaderUid) && !privilegedSelfReview)
    throw new Error("SELF_APPROVAL");
  return uploaderUid;
}

async function replacePriorCertificate(input: {
  transaction: FirebaseFirestore.Transaction;
  snap: FirebaseFirestore.DocumentSnapshot;
  certificateId: string;
  actorUid: string;
  timestamp: FirebaseFirestore.FieldValue;
}): Promise<{ certificateId: string; session: string }> {
  const { transaction, snap, certificateId, actorUid, timestamp } = input;
  const replacesId = String(snap.get("replacesId") ?? "");
  if (!replacesId) return { certificateId: "", session: "" };
  const oldRef = db.collection("certificates").doc(replacesId);
  const oldSnap = await transaction.get(oldRef);
  const sameStudent = oldSnap.get("studentId") === snap.get("studentId");
  if (!oldSnap.exists || oldSnap.get("status") !== "published" || !sameStudent)
    throw new Error("REPLACED_CERTIFICATE_UNAVAILABLE");
  transaction.update(oldRef, {
    status: "superseded",
    published: false,
    supersededBy: certificateId,
    supersededAt: timestamp,
    updatedBy: actorUid,
    updatedAt: timestamp,
  });
  return { certificateId: replacesId, session: String(oldSnap.get("session") ?? "") };
}

async function applyDecisionTransaction(
  certificateId: string,
  actor: { uid: string; role: string },
  decision: DecisionInput["decision"],
  reason: string,
) {
  const ref = db.collection("certificates").doc(certificateId);
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    assertReviewable(snap, actor, decision);
    const now = FieldValue.serverTimestamp();
    const replaced =
      decision === "approve"
        ? await replacePriorCertificate({
            transaction,
            snap,
            certificateId,
            actorUid: actor.uid,
            timestamp: now,
          })
        : { certificateId: "", session: "" };
    const values =
      decision === "approve"
        ? {
            status: "published",
            published: true,
            approvedBy: actor.uid,
            approvedAt: now,
            updatedBy: actor.uid,
            updatedAt: now,
            rejectionReason: FieldValue.delete(),
          }
        : {
            status: "rejected",
            published: false,
            rejectedBy: actor.uid,
            rejectedAt: now,
            rejectionReason: reason,
            updatedBy: actor.uid,
            updatedAt: now,
          };
    transaction.update(ref, values);
    return {
      studentId: String(snap.get("studentId") ?? ""),
      session: String(snap.get("session") ?? ""),
      type: String(snap.get("type") ?? ""),
      replacedCertificateId: replaced.certificateId,
      replacedSession: replaced.session,
    };
  });
}

async function updatePublicSessions(result: Awaited<ReturnType<typeof applyDecisionTransaction>>) {
  const changes: { session: string; delta: 1 | -1 }[] = [{ session: result.session, delta: 1 }];
  if (result.replacedCertificateId && result.replacedSession)
    changes.push({ session: result.replacedSession, delta: -1 });
  await adjustPublicSessions(changes).catch(async () => rebuildPublicSessions());
}

async function finishDecision(input: {
  request: NextRequest;
  actorUid: string;
  decision: DecisionInput["decision"];
  certificateId: string;
  result: Awaited<ReturnType<typeof applyDecisionTransaction>>;
}): Promise<void> {
  const { request, actorUid, decision, certificateId, result } = input;
  if (decision === "approve") await updatePublicSessions(result);
  if (decision === "reject") await removeCertificateNumberIndex(certificateId);
  const action = decision === "approve" ? "certificate.approved" : "certificate.rejected";
  await writeAuditLog(request, actorUid, action, certificateId, result.studentId);
  if (decision === "approve" && result.replacedCertificateId)
    await writeAuditLog(
      request,
      actorUid,
      "certificate.replaced",
      result.replacedCertificateId,
      result.studentId,
    );
  if (decision === "approve" && result.studentId)
    await sendCertificateAvailableNotice(result.studentId).catch(() => {
      console.error("Consent-based certificate notification could not be sent.");
    });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    const actor = await requireRoles(request, ["approver", "admin"]);
    const { certificateId } = await context.params;
    const input = parseDecisionInput(await request.json());
    if ("error" in input) return NextResponse.json({ error: input.error }, { status: 400 });
    const { decision, reason } = input;
    if (decision === "approve") await ensurePublicSessions();
    const result = await applyDecisionTransaction(certificateId, actor, decision, reason);
    await finishDecision({ request, actorUid: actor.uid, decision, certificateId, result });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return decisionErrorResponse(error) ?? apiError(error);
  }
}
