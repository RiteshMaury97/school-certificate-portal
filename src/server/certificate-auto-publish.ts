import "server-only";
import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/server/firebase-admin";
import { sendCertificateAvailableNotice } from "@/server/notifications";
import {
  adjustPublicSessions,
  ensurePublicSessions,
  rebuildPublicSessions,
} from "@/server/public-sessions";

/** Publish uploads made by trusted administrator roles, preserving replacement history. */
export async function publishCertificateWithoutReview(
  certificateId: string,
  actorUid: string,
): Promise<{ studentId: string; replacedCertificateId: string }> {
  await ensurePublicSessions();
  const certificateRef = db.collection("certificates").doc(certificateId);
  const published = await db.runTransaction(async (transaction) => {
    const certificate = await transaction.get(certificateRef);
    if (!certificate.exists) throw new Error("CERTIFICATE_NOT_FOUND");
    if (certificate.get("status") !== "pending")
      throw new Error("CERTIFICATE_NOT_PENDING");

    const studentId = String(certificate.get("studentId") ?? "");
    const session = String(certificate.get("session") ?? "");
    const replacesId = String(certificate.get("replacesId") ?? "");
    let replacedSession = "";
    if (replacesId) {
      const replacedRef = db.collection("certificates").doc(replacesId);
      const replaced = await transaction.get(replacedRef);
      if (
        !replaced.exists ||
        replaced.get("status") !== "published" ||
        replaced.get("studentId") !== studentId
      )
        throw new Error("REPLACED_CERTIFICATE_UNAVAILABLE");
      replacedSession = String(replaced.get("session") ?? "");
      transaction.update(replacedRef, {
        status: "superseded",
        published: false,
        supersededBy: certificateId,
        supersededAt: FieldValue.serverTimestamp(),
        updatedBy: actorUid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.update(certificateRef, {
      status: "published",
      published: true,
      approvedBy: actorUid,
      approvedAt: FieldValue.serverTimestamp(),
      updatedBy: actorUid,
      updatedAt: FieldValue.serverTimestamp(),
      rejectionReason: FieldValue.delete(),
    });
    return { studentId, session, replacesId, replacedSession };
  });

  const changes: { session: string; delta: 1 | -1 }[] = [
    { session: published.session, delta: 1 },
  ];
  if (published.replacesId && published.replacedSession)
    changes.push({ session: published.replacedSession, delta: -1 });
  await adjustPublicSessions(changes).catch(rebuildPublicSessions);
  await sendCertificateAvailableNotice(published.studentId).catch(() => {
    console.error("Consent-based certificate notification could not be sent.");
  });
  return {
    studentId: published.studentId,
    replacedCertificateId: published.replacesId,
  };
}
