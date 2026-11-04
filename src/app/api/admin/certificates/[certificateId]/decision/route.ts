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

import type { NextRequest} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    const actor = await requireRoles(request, ["approver", "admin"]);
    const { certificateId } = await context.params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || !("decision" in body))
      return NextResponse.json(
        { error: "Choose approve or reject." },
        { status: 400 },
      );
    const decision = typeof body.decision === "string" ? body.decision : "";
    const reason =
      "reason" in body && typeof body.reason === "string"
        ? body.reason.trim()
        : "";
    const detailsMatch = "detailsMatch" in body && body.detailsMatch === true;
    if (decision !== "approve" && decision !== "reject")
      return NextResponse.json({ error: "Invalid decision." }, { status: 400 });
    if (decision === "reject" && (reason.length < 10 || reason.length > 1000))
      return NextResponse.json(
        {
          error: "Enter a rejection reason of at least 10 characters.",
        },
        { status: 400 },
      );
    if (decision === "approve" && !detailsMatch)
      return NextResponse.json(
        {
          error: "Confirm that the details match the document before approval.",
        },
        { status: 400 },
      );
    if (decision === "approve") await ensurePublicSessions();
    const ref = db.collection("certificates").doc(certificateId);
    const result = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("NOT_FOUND");
      if (snap.get("status") !== "pending") throw new Error("NOT_PENDING");
      if (decision === "approve" && snap.get("scanStatus") !== "clean")
        throw new Error("MALWARE_SCAN_NOT_CLEAN");
      const uploaderUid = String(snap.get("uploadedBy") ?? "");
      if (!uploaderUid) throw new Error("UPLOADER_UNKNOWN");
      const privilegedSelfReview =
        actor.uid === uploaderUid &&
        (actor.role === "admin" || actor.role === "superadmin");
      if (!canReviewUpload(actor.uid, uploaderUid) && !privilegedSelfReview)
        throw new Error("SELF_APPROVAL");
      const now = FieldValue.serverTimestamp();
      let replacedCertificateId = "";
      let replacedSession = "";
      if (decision === "approve") {
        const replacesId = String(snap.get("replacesId") ?? "");
        if (replacesId) {
          const oldRef = db.collection("certificates").doc(replacesId);
          const oldSnap = await tx.get(oldRef);
          if (
            !oldSnap.exists ||
            oldSnap.get("status") !== "published" ||
            oldSnap.get("studentId") !== snap.get("studentId")
          ) {
            throw new Error("REPLACED_CERTIFICATE_UNAVAILABLE");
          }
          tx.update(oldRef, {
            status: "superseded",
            published: false,
            supersededBy: certificateId,
            supersededAt: now,
            updatedBy: actor.uid,
            updatedAt: now,
          });
          replacedCertificateId = replacesId;
          replacedSession = String(oldSnap.get("session") ?? "");
        }
        tx.update(ref, {
          status: "published",
          published: true,
          approvedBy: actor.uid,
          approvedAt: now,
          updatedBy: actor.uid,
          updatedAt: now,
          rejectionReason: FieldValue.delete(),
        });
      } else {
        tx.update(ref, {
          status: "rejected",
          published: false,
          rejectedBy: actor.uid,
          rejectedAt: now,
          rejectionReason: reason,
          updatedBy: actor.uid,
          updatedAt: now,
        });
      }
      return {
        studentId: String(snap.get("studentId") ?? ""),
        session: String(snap.get("session") ?? ""),
        type: String(snap.get("type") ?? ""),
        replacedCertificateId,
        replacedSession,
      };
    });
    if (decision === "approve") {
      const changes: { session: string; delta: 1 | -1 }[] = [
        { session: result.session, delta: 1 },
      ];
      if (result.replacedCertificateId && result.replacedSession)
        changes.push({ session: result.replacedSession, delta: -1 });
      await adjustPublicSessions(changes).catch(async () =>
        rebuildPublicSessions(),
      );
    }
    if (decision === "reject")
      await removeCertificateNumberIndex(certificateId);
    await writeAuditLog(
      request,
      actor.uid,
      decision === "approve" ? "certificate.approved" : "certificate.rejected",
      certificateId,
      result.studentId,
    );
    if (decision === "approve" && result.replacedCertificateId)
      await writeAuditLog(
        request,
        actor.uid,
        "certificate.replaced",
        result.replacedCertificateId,
        result.studentId,
      );
    if (decision === "approve" && result.studentId)
      await sendCertificateAvailableNotice(result.studentId).catch(() => { console.error(
          "Consent-based certificate notification could not be sent.",
        ); },
      );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND")
      return NextResponse.json(
        { error: "Certificate not found." },
        { status: 404 },
      );
    if (error instanceof Error && error.message === "NOT_PENDING")
      return NextResponse.json(
        { error: "This certificate is no longer pending." },
        { status: 409 },
      );
    if (error instanceof Error && error.message === "MALWARE_SCAN_NOT_CLEAN")
      return NextResponse.json(
        { error: "This certificate cannot be approved until a clean security scan is recorded." },
        { status: 409 },
      );
    if (error instanceof Error && error.message === "SELF_APPROVAL")
      return NextResponse.json(
        { error: "The uploader cannot approve or reject their own upload." },
        { status: 403 },
      );
    if (
      error instanceof Error &&
      error.message === "REPLACED_CERTIFICATE_UNAVAILABLE"
    )
      return NextResponse.json(
        {
          error:
            "The original published certificate is no longer eligible for replacement.",
        },
        { status: 409 },
      );
    if (error instanceof Error && error.message === "UPLOADER_UNKNOWN")
      return NextResponse.json(
        {
          error:
            "Uploader identity is missing. Reconcile this legacy record before approval.",
        },
        { status: 409 },
      );
    return apiError(error);
  }
}
