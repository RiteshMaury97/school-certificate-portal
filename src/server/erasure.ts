import "server-only";
import { randomUUID } from "node:crypto";

import {
  FieldValue,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { db } from "@/server/firebase-admin";
import { rebuildPublicSessions } from "@/server/public-sessions";
import { deleteR2Object, purgeStudentR2Objects } from "@/server/r2";

type ErasureReason = "data-principal-request";
type ErasureArgs = [
  studentId: string,
  actorUid: string,
  reason: ErasureReason,
  existingErasureId?: string,
  dataRightsRequestId?: string,
  requesterEmail?: string,
];
type ErasureRequest = {
  studentId: string;
  actorUid: string;
  reason: ErasureReason;
  existingErasureId?: string;
  dataRightsRequestId?: string;
  requesterEmail?: string;
};
type DeletedCounts = {
  r2Objects: number;
  r2MetadataMatchedObjects: number;
  firestoreDocuments: number;
  indexEntries: number;
  relatedRecords: number;
  legallyRetainedRedactedRecords: number;
};

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function resolveErasureContext(input: ErasureRequest) {
  const studentRef = db.collection("students").doc(input.studentId);
  const retryJob = await findRetryErasureJob(input);
  const student = await studentRef.get();
  if (student.exists && student.get("legalHold") === true) throw new Error("ERASURE_LEGAL_HOLD");
  const job = await resolveErasureJob(input, retryJob, student.exists);
  return { ...job, studentRef, student };
}

async function resolveErasureJob(
  input: ErasureRequest,
  retryJob: Awaited<ReturnType<typeof findRetryErasureJob>>,
  studentExists: boolean,
) {
  if (input.existingErasureId) {
    const jobRef = db.collection("erasureJobs").doc(input.existingErasureId);
    const job = await jobRef.get();
    assertRetryableErasureJob(job, input.studentId);
    return { erasureId: input.existingErasureId, jobRef, job };
  }
  if (retryJob) {
    assertRetryableErasureJob(retryJob, input.studentId);
    return { erasureId: retryJob.id, jobRef: retryJob.ref, job: retryJob };
  }
  if (!studentExists) throw new Error("STUDENT_NOT_FOUND");
  return createErasureJob(input);
}

function assertRetryableErasureJob(
  job: DocumentSnapshot,
  studentId: string,
): void {
  if (!job.exists || job.get("studentId") !== studentId || job.get("status") !== "retry_required") {
    throw new Error("ERASURE_JOB_NOT_RETRYABLE");
  }
}

async function findRetryErasureJob(input: ErasureRequest) {
  if (input.existingErasureId) return null;
  const retryJobs = await db
    .collection("erasureJobs")
    .where("studentId", "==", input.studentId)
    .limit(20)
    .get();
  return (
    retryJobs.docs.find(
      (document) =>
        document.get("status") === "retry_required" &&
        document.get("reason") === input.reason,
    ) ?? null
  );
}

async function createErasureJob(input: ErasureRequest) {
  const erasureId = `ER-${randomUUID()}`;
  const jobRef = db.collection("erasureJobs").doc(erasureId);
  await jobRef.create({
    status: "started",
    studentId: input.studentId,
    actorUid: input.actorUid,
    reason: input.reason,
    ...(input.dataRightsRequestId ? { dataRightsRequestId: input.dataRightsRequestId } : {}),
    ...(input.requesterEmail ? { requesterEmail: input.requesterEmail } : {}),
    startedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { erasureId, jobRef, job: await jobRef.get() };
}

async function collectErasureTargets(context: Awaited<ReturnType<typeof resolveErasureContext>>) {
  let certificates;
  try {
    certificates = await db
      .collection("certificates")
      .where("studentId", "==", context.student.ref.id)
      .get();
  } catch (error: unknown) {
    await context.jobRef.set(
      {
        status: "retry_required",
        lastErrorCode: "ERASURE_PREPARATION_FAILED",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }
  const certificateIds = [
    ...new Set([
      ...strings(context.job.get("certificateIds")),
      ...certificates.docs.map((document) => document.id),
    ]),
  ];
  const keys = [
    ...new Set([
      ...strings(context.job.get("r2Keys")),
      ...certificates.docs.map((document) => String(document.get("r2Key") ?? "")).filter(Boolean),
    ]),
  ];
  const hashes = [
    ...new Set([
      ...strings(context.job.get("sha256s")),
      ...certificates.docs.map((document) => String(document.get("sha256") ?? "")).filter(Boolean),
    ]),
  ];
  return { certificates, certificateIds, keys, hashes };
}

function initialDeletedCounts(job: Awaited<ReturnType<typeof resolveErasureContext>>["job"]): DeletedCounts {
  const deletedCounts: unknown = job.get("deletedCounts");
  const prior = isRecord(deletedCounts) ? deletedCounts : {};
  return {
    r2Objects: Number(prior.r2Objects ?? 0),
    r2MetadataMatchedObjects: Number(prior.r2MetadataMatchedObjects ?? 0),
    firestoreDocuments: Number(prior.firestoreDocuments ?? 0),
    indexEntries: Number(prior.indexEntries ?? 0),
    relatedRecords: Number(prior.relatedRecords ?? 0),
    legallyRetainedRedactedRecords: Number(prior.legallyRetainedRedactedRecords ?? 0),
  };
}

function deletedCountsSnapshot(counts: DeletedCounts): DeletedCounts {
  return { ...counts };
}

async function markErasurePending(
  input: ErasureRequest,
  context: Awaited<ReturnType<typeof resolveErasureContext>>,
  targets: Awaited<ReturnType<typeof collectErasureTargets>>,
): Promise<void> {
  await context.jobRef.set(
    {
      status: "started",
      studentId: input.studentId,
      actorUid: input.actorUid,
      reason: input.reason,
      ...(input.dataRightsRequestId ? { dataRightsRequestId: input.dataRightsRequestId } : {}),
      ...(input.requesterEmail ? { requesterEmail: input.requesterEmail } : {}),
      certificateIds: targets.certificateIds,
      r2Keys: targets.keys,
      sha256s: targets.hashes,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  if (context.student.exists) {
    await context.studentRef.set(
      {
        erasurePending: true,
        erasureJobId: context.erasureId,
        erasureStartedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
  for (let offset = 0; offset < targets.certificates.docs.length; offset += 400) {
    const batch = db.batch();
    for (const certificate of targets.certificates.docs.slice(offset, offset + 400)) {
      batch.set(certificate.ref, { erasurePending: true }, { merge: true });
    }
    if (offset < targets.certificates.docs.length) await batch.commit();
  }
}

async function deleteStorageTargets(
  studentId: string,
  keys: string[],
  hashes: string[],
  counts: DeletedCounts,
): Promise<void> {
  for (const key of keys) {
    if (await deleteR2Object(key)) counts.r2Objects++;
  }
  const sweep = await purgeStudentR2Objects(studentId, hashes);
  counts.r2MetadataMatchedObjects += sweep.deleted;
  if (sweep.ambiguous > 0 || sweep.unattributed > 0)
    throw new Error("ERASURE_STORAGE_RECONCILIATION_REQUIRED");
}

async function deleteCertificateIndexes(certificateIds: string[]): Promise<number> {
  let deleted = 0;
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
      if (matches.empty) continue;
      const batch = db.batch();
      for (const document of matches.docs) batch.delete(document.ref);
      await batch.commit();
      deleted += matches.size;
    }
  }
  return deleted;
}

function requiresLegalRetention(name: string, document: QueryDocumentSnapshot): boolean {
  return (
    (name === "reports" || name === "supportTickets" || name === "consentLogs") &&
    (document.get("legalHold") === true || document.get("retainForLegalReason") === true)
  );
}

function legalRetentionData(
  name: string,
  document: QueryDocumentSnapshot,
  erasureId: string,
): Record<string, unknown> {
  const retained = {
    retainedForLegalReason: true,
    retentionCategory: "legal_hold",
    erasureId,
    personalDataErasedAt: FieldValue.serverTimestamp(),
    retainedAt: FieldValue.serverTimestamp(),
  };
  if (name === "consentLogs") {
    const policyVersion: unknown = document.get("policyVersion");
    const consentTimestamp: unknown = document.get("timestamp");
    return { ...retained, policyVersion: policyVersion ?? null, consentTimestamp: consentTimestamp ?? null };
  }
  const status: unknown = document.get("status");
  return { ...retained, status: status === "closed" ? "closed" : "retained" };
}

async function eraseRelatedRecords(
  studentId: string,
  erasureId: string,
): Promise<{ deleted: number; retained: number }> {
  let deleted = 0;
  let retained = 0;
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
    for (const document of matches.docs) {
      if (requiresLegalRetention(name, document)) {
        batch.set(document.ref, legalRetentionData(name, document, erasureId));
        retained++;
      } else {
        batch.delete(document.ref);
        deleted++;
      }
    }
    await batch.commit();
  }
  return { deleted, retained };
}

async function resolveDataRightsRequest(requestId: string, erasureId: string): Promise<void> {
  await db.collection("dataRightsRequests").doc(requestId).set(
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

async function deleteCertificateDocuments(
  certificates: Awaited<ReturnType<typeof collectErasureTargets>>["certificates"],
): Promise<number> {
  let deleted = 0;
  for (let offset = 0; offset < certificates.docs.length; offset += 400) {
    const batch = db.batch();
    for (const document of certificates.docs.slice(offset, offset + 400)) {
      batch.delete(document.ref);
    }
    await batch.commit();
    deleted += Math.min(400, certificates.docs.length - offset);
  }
  return deleted;
}

async function hasCertificateIndex(certificateIds: string[]): Promise<boolean> {
  for (const certificateId of certificateIds) {
    for (const name of [
      "certificateNumberIndex",
      "certificateVerificationIndex",
      "certificateHashIndex",
    ]) {
      const matches = await db
        .collection(name)
        .where("certificateId", "==", certificateId)
        .limit(1)
        .get();
      if (!matches.empty) return true;
    }
  }
  return false;
}

async function hasRelatedRecords(studentId: string): Promise<boolean> {
  for (const name of [
    "consentLogs",
    "reports",
    "supportTickets",
    "dataRightsRequests",
    "studentSearchIndex",
    "certificateVerificationIndex",
    "auditLogs",
  ]) {
    const matches = await db.collection(name).where("studentId", "==", studentId).limit(1).get();
    if (!matches.empty) return true;
  }
  return false;
}

async function verifyErasure(
  studentId: string,
  certificateIds: string[],
  hashes: string[],
): Promise<void> {
  const student = await db.collection("students").doc(studentId).get();
  const certificates = await db
    .collection("certificates")
    .where("studentId", "==", studentId)
    .limit(1)
    .get();
  const indexRemains = await hasCertificateIndex(certificateIds);
  const relatedRemains = await hasRelatedRecords(studentId);
  const storage = await purgeStudentR2Objects(studentId, hashes);
  if (storage.ambiguous > 0 || storage.unattributed > 0)
    throw new Error("ERASURE_STORAGE_RECONCILIATION_REQUIRED");
  const review = await db.collection("retentionReview").doc(studentId).get();
  if (
    student.exists ||
    !certificates.empty ||
    indexRemains ||
    relatedRemains ||
    storage.deleted > 0 ||
    review.exists
  )
    throw new Error("ERASURE_VERIFICATION_FAILED");
}

async function completeErasure(
  input: ErasureRequest,
  context: Awaited<ReturnType<typeof resolveErasureContext>>,
  counts: DeletedCounts,
): Promise<void> {
  const receipt = {
    erasureId: context.erasureId,
    action: "student.erasure.complete",
    actorUid: input.actorUid,
    reason: input.reason,
    deletedCounts: deletedCountsSnapshot(counts),
    timestamp: FieldValue.serverTimestamp(),
  };
  await db.collection("auditLogs").add(receipt);
  await db.collection("retentionReviewCompleted").doc(context.erasureId).set({
    status: "complete",
    erasureId: context.erasureId,
    reviewedBy: input.actorUid,
    reviewedAt: FieldValue.serverTimestamp(),
  });
  await context.jobRef.set(
    {
      status: "complete",
      studentId: FieldValue.delete(),
      certificateIds: FieldValue.delete(),
      r2Keys: FieldValue.delete(),
      sha256s: FieldValue.delete(),
      actorUid: input.actorUid,
      reason: input.reason,
      completedAt: FieldValue.serverTimestamp(),
      deletedCounts: deletedCountsSnapshot(counts),
      verified: true,
    },
    { merge: true },
  );
}

export async function eraseStudentData(...args: ErasureArgs) {
  const [studentId, actorUid, reason, existingErasureId, dataRightsRequestId, requesterEmail] = args;
  const input: ErasureRequest = {
    studentId,
    actorUid,
    reason,
    ...(existingErasureId ? { existingErasureId } : {}),
    ...(dataRightsRequestId ? { dataRightsRequestId } : {}),
    ...(requesterEmail ? { requesterEmail } : {}),
  };
  const context = await resolveErasureContext(input);
  const targets = await collectErasureTargets(context);
  const counts = initialDeletedCounts(context.job);

  try {
    await markErasurePending(input, context, targets);
    await deleteStorageTargets(studentId, targets.keys, targets.hashes, counts);
    counts.indexEntries += await deleteCertificateIndexes(targets.certificateIds);

    const related = await eraseRelatedRecords(studentId, context.erasureId);
    counts.relatedRecords += related.deleted;
    counts.legallyRetainedRedactedRecords += related.retained;

    if (dataRightsRequestId) await resolveDataRightsRequest(dataRightsRequestId, context.erasureId);
    counts.firestoreDocuments += await deleteCertificateDocuments(targets.certificates);
    if (targets.certificates.docs.some((document) => document.get("status") === "published")) {
      await rebuildPublicSessions();
    }
    if (context.student.exists) {
      await context.studentRef.delete();
      counts.firestoreDocuments++;
    }
    // These legacy-named markers are part of the data-rights erasure audit
    // trail and verification flow; they are not the removed review queue.
    await db.collection("retentionReview").doc(studentId).delete();
    await verifyErasure(studentId, targets.certificateIds, targets.hashes);
    await completeErasure(input, context, counts);
    return { erasureId: context.erasureId, deletedCounts: deletedCountsSnapshot(counts), verified: true };
  } catch (error) {
    await context.jobRef.set(
      {
        status: "retry_required",
        lastErrorCode:
          error instanceof Error && /^ERASURE_[A-Z_]+$/.test(error.message)
            ? error.message
            : "ERASURE_FAILED",
        updatedAt: FieldValue.serverTimestamp(),
        deletedCounts: deletedCountsSnapshot(counts),
      },
      { merge: true },
    );
    throw error;
  }
}
