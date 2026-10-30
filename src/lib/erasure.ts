import "server-only";
import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/src/lib/firebase-admin";
import { deleteR2Object, purgeStudentR2Objects } from "@/src/lib/r2";
import { rebuildPublicSessions } from "@/src/lib/public-sessions";

type ErasureReason = "retention" | "data-principal-request";
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];

export async function eraseStudentData(
  studentId: string,
  actorUid: string,
  reason: ErasureReason,
  existingErasureId?: string,
  dataRightsRequestId?: string,
  requesterEmail?: string,
) {
  const studentRef = db.collection("students").doc(studentId);
  let erasureId = existingErasureId ?? "";
  let jobRef = erasureId ? db.collection("erasureJobs").doc(erasureId) : null;
  let job = jobRef ? await jobRef.get() : null;
  if (!existingErasureId) {
    const retryJobs = await db
      .collection("erasureJobs")
      .where("studentId", "==", studentId)
      .limit(20)
      .get();
    const retry = retryJobs.docs.find(
      (d) => d.get("status") === "retry_required",
    );
    if (retry) {
      erasureId = retry.id;
      jobRef = retry.ref;
      job = retry;
    }
  }
  const student = await studentRef.get();
  if (student.exists && student.get("legalHold") === true)
    throw new Error("ERASURE_LEGAL_HOLD");
  if (!jobRef) {
    if (!student.exists) throw new Error("STUDENT_NOT_FOUND");
    erasureId = `ER-${randomUUID()}`;
    jobRef = db.collection("erasureJobs").doc(erasureId);
    await jobRef.create({
      status: "started",
      studentId,
      actorUid,
      reason,
      ...(dataRightsRequestId ? { dataRightsRequestId } : {}),
      ...(requesterEmail ? { requesterEmail } : {}),
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    job = await jobRef.get();
  } else if (
    !job?.exists ||
    job.get("studentId") !== studentId ||
    job.get("status") !== "retry_required"
  )
    throw new Error("ERASURE_JOB_NOT_RETRYABLE");
  if (!jobRef || !job) throw new Error("ERASURE_JOB_UNAVAILABLE");
  const certs = await db
    .collection("certificates")
    .where("studentId", "==", studentId)
    .get()
    .catch(async (error) => {
      await jobRef.set(
        {
          status: "retry_required",
          lastErrorCode: "ERASURE_PREPARATION_FAILED",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      throw error;
    });
  const certificateIds = [
    ...new Set([
      ...strings(job.get("certificateIds")),
      ...certs.docs.map((d) => d.id),
    ]),
  ];
  const keys = [
    ...new Set([
      ...strings(job.get("r2Keys")),
      ...certs.docs.map((d) => String(d.get("r2Key") ?? "")).filter(Boolean),
    ]),
  ];
  const hashes = [
    ...new Set([
      ...strings(job.get("sha256s")),
      ...certs.docs.map((d) => String(d.get("sha256") ?? "")).filter(Boolean),
    ]),
  ];
  const prior = (job?.get("deletedCounts") ?? {}) as Record<string, unknown>;
  let r2Deleted = Number(prior.r2Objects ?? 0),
    r2MetadataMatchedDeleted = Number(prior.r2MetadataMatchedObjects ?? 0),
    firestoreDeleted = Number(prior.firestoreDocuments ?? 0),
    indexDeleted = Number(prior.indexEntries ?? 0),
    relatedDeleted = Number(prior.relatedRecords ?? 0),
    relatedRetainedRedacted = Number(prior.legallyRetainedRedactedRecords ?? 0);
  const counts = () => ({
    r2Objects: r2Deleted,
    r2MetadataMatchedObjects: r2MetadataMatchedDeleted,
    firestoreDocuments: firestoreDeleted,
    indexEntries: indexDeleted,
    relatedRecords: relatedDeleted,
    legallyRetainedRedactedRecords: relatedRetainedRedacted,
  });
  try {
    await jobRef.set(
      {
        status: "started",
        studentId,
        actorUid,
        reason,
        ...(dataRightsRequestId ? { dataRightsRequestId } : {}),
        ...(requesterEmail ? { requesterEmail } : {}),
        certificateIds,
        r2Keys: keys,
        sha256s: hashes,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    if (student.exists)
      await studentRef.set(
        {
          erasurePending: true,
          erasureJobId: erasureId,
          erasureStartedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    for (let offset = 0; offset < certs.docs.length; offset += 400) {
      const batch = db.batch();
      certs.docs
        .slice(offset, offset + 400)
        .forEach((d) =>
          batch.set(d.ref, { erasurePending: true }, { merge: true }),
        );
      if (offset < certs.docs.length) await batch.commit();
    }
    for (const key of keys) {
      if (await deleteR2Object(key)) r2Deleted++;
    }
    const storageSweep = await purgeStudentR2Objects(studentId, hashes);
    r2MetadataMatchedDeleted += storageSweep.deleted;
    if (storageSweep.ambiguous > 0 || storageSweep.unattributed > 0)
      throw new Error("ERASURE_STORAGE_RECONCILIATION_REQUIRED");
    for (const certificateId of certificateIds) {
      for (const name of [
        "certificateNumberIndex",
        "certificateVerificationIndex",
        "certificateHashIndex",
      ]) {
        const matches = await db
          .collection(name)
          .where("certificateId", "==", certificateId)
          .limit(500)
          .get();
        if (!matches.empty) {
          const batch = db.batch();
          matches.docs.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          indexDeleted += matches.size;
        }
      }
    }
    for (const name of [
      "consentLogs",
      "reports",
      "supportTickets",
      "dataRightsRequests",
      "studentSearchIndex",
      "certificateVerificationIndex",
      "auditLogs",
    ]) {
      const matches = await db
        .collection(name)
        .where("studentId", "==", studentId)
        .limit(500)
        .get();
      if (matches.empty) continue;
      const batch = db.batch();
      for (const doc of matches.docs) {
        if (
          (name === "reports" ||
            name === "supportTickets" ||
            name === "consentLogs") &&
          (doc.get("legalHold") === true ||
            doc.get("retainForLegalReason") === true)
        ) {
          batch.set(doc.ref, {
            retainedForLegalReason: true,
            retentionCategory: "legal_hold",
            erasureId,
            personalDataErasedAt: FieldValue.serverTimestamp(),
            retainedAt: FieldValue.serverTimestamp(),
            ...(name === "consentLogs"
              ? {
                  policyVersion: doc.get("policyVersion") ?? null,
                  consentTimestamp: doc.get("timestamp") ?? null,
                }
              : {
                  status:
                    doc.get("status") === "closed" ? "closed" : "retained",
                }),
          });
          relatedRetainedRedacted++;
        } else {
          batch.delete(doc.ref);
          relatedDeleted++;
        }
      }
      await batch.commit();
    }
    if (dataRightsRequestId) {
      await db
        .collection("dataRightsRequests")
        .doc(dataRightsRequestId)
        .set(
          {
            status: "resolved",
            resolution: "Erasure completed",
            erasureId,
            closedAt: FieldValue.serverTimestamp(),
            requesterName: FieldValue.delete(),
            contactEmail: FieldValue.delete(),
            studentName: FieldValue.delete(),
            description: FieldValue.delete(),
            studentId: FieldValue.delete(),
            ipHash: FieldValue.delete(),
          },
          { merge: true },
        );
    }
    for (let offset = 0; offset < certs.docs.length; offset += 400) {
      const batch = db.batch();
      certs.docs
        .slice(offset, offset + 400)
        .forEach((d) => batch.delete(d.ref));
      await batch.commit();
      firestoreDeleted += Math.min(400, certs.docs.length - offset);
    }
    if (certs.docs.some((d) => d.get("status") === "published"))
      await rebuildPublicSessions();
    if (student.exists) {
      await studentRef.delete();
      firestoreDeleted++;
    }
    await db.collection("retentionReview").doc(studentId).delete();
    const verifyStudent = await studentRef.get();
    const verifyCerts = await db
      .collection("certificates")
      .where("studentId", "==", studentId)
      .limit(1)
      .get();
    let indexRemains = false;
    for (const certificateId of certificateIds) {
      for (const name of [
        "certificateNumberIndex",
        "certificateVerificationIndex",
        "certificateHashIndex",
      ]) {
        const indexes = await db
          .collection(name)
          .where("certificateId", "==", certificateId)
          .limit(1)
          .get();
        if (!indexes.empty) {
          indexRemains = true;
          break;
        }
      }
      if (indexRemains) break;
    }
    let relatedRemains = false;
    for (const name of [
      "consentLogs",
      "reports",
      "supportTickets",
      "dataRightsRequests",
      "studentSearchIndex",
      "certificateVerificationIndex",
      "auditLogs",
    ]) {
      const matches = await db
        .collection(name)
        .where("studentId", "==", studentId)
        .limit(1)
        .get();
      if (!matches.empty) {
        relatedRemains = true;
        break;
      }
    }
    const verifyStorage = await purgeStudentR2Objects(studentId, hashes);
    if (verifyStorage.ambiguous > 0 || verifyStorage.unattributed > 0)
      throw new Error("ERASURE_STORAGE_RECONCILIATION_REQUIRED");
    const verifyReview = await db
      .collection("retentionReview")
      .doc(studentId)
      .get();
    if (
      verifyStudent.exists ||
      !verifyCerts.empty ||
      indexRemains ||
      relatedRemains ||
      verifyStorage.deleted > 0 ||
      verifyReview.exists
    )
      throw new Error("ERASURE_VERIFICATION_FAILED");
    const receipt = {
      erasureId,
      action: "student.erasure.complete",
      actorUid,
      reason,
      deletedCounts: counts(),
      timestamp: FieldValue.serverTimestamp(),
    };
    await db.collection("auditLogs").add(receipt);
    await db
      .collection("retentionReviewCompleted")
      .doc(erasureId)
      .set({
        status: "complete",
        erasureId,
        reviewedBy: actorUid,
        reviewedAt: FieldValue.serverTimestamp(),
      });
    await jobRef.set(
      {
        status: "complete",
        studentId: FieldValue.delete(),
        certificateIds: FieldValue.delete(),
        r2Keys: FieldValue.delete(),
        sha256s: FieldValue.delete(),
        actorUid,
        reason,
        completedAt: FieldValue.serverTimestamp(),
        deletedCounts: counts(),
        verified: true,
      },
      { merge: true },
    );
    return { erasureId, deletedCounts: counts(), verified: true };
  } catch (error) {
    await jobRef.set(
      {
        status: "retry_required",
        lastErrorCode:
          error instanceof Error && /^ERASURE_[A-Z_]+$/.test(error.message)
            ? error.message
            : "ERASURE_FAILED",
        updatedAt: FieldValue.serverTimestamp(),
        deletedCounts: counts(),
      },
      { merge: true },
    );
    throw error;
  }
}
