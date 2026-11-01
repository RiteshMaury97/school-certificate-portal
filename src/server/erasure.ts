import "server-only";
import { randomUUID } from "node:crypto";

import {
  FieldValue,
  type DocumentReference,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { db } from "@/server/firebase-admin";
import { rebuildPublicSessions } from "@/server/public-sessions";
import { deleteR2Object, purgeStudentR2Objects } from "@/server/r2";

type ErasureReason = "retention" | "data-principal-request";
type ErasureInput = {
  studentId: string;
  actorUid: string;
  reason: ErasureReason;
  existingErasureId?: string;
  dataRightsRequestId?: string;
  requesterEmail?: string;
};
type ErasureContext = {
  studentRef: DocumentReference;
  student: DocumentSnapshot;
  erasureId: string;
  jobRef: DocumentReference;
  job: DocumentSnapshot;
};
type ErasurePlan = {
  certificates: QueryDocumentSnapshot[];
  certificateIds: string[];
  keys: string[];
  hashes: string[];
};
type ErasureCounts = {
  r2Objects: number;
  r2MetadataMatchedObjects: number;
  firestoreDocuments: number;
  indexEntries: number;
  relatedRecords: number;
  legallyRetainedRedactedRecords: number;
};

const RELATED_COLLECTIONS = [
  "consentLogs",
  "reports",
  "supportTickets",
  "dataRightsRequests",
  "studentSearchIndex",
  "certificateVerificationIndex",
  "auditLogs",
] as const;
const CERTIFICATE_INDEXES = [
  "certificateNumberIndex",
  "certificateVerificationIndex",
  "certificateHashIndex",
] as const;

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function initialCounts(job: DocumentSnapshot): ErasureCounts {
  const priorValue: unknown = job.get("deletedCounts");
  const prior = isRecord(priorValue) ? priorValue : {};
  return {
    r2Objects: Number(prior.r2Objects ?? 0),
    r2MetadataMatchedObjects: Number(prior.r2MetadataMatchedObjects ?? 0),
    firestoreDocuments: Number(prior.firestoreDocuments ?? 0),
    indexEntries: Number(prior.indexEntries ?? 0),
    relatedRecords: Number(prior.relatedRecords ?? 0),
    legallyRetainedRedactedRecords: Number(prior.legallyRetainedRedactedRecords ?? 0),
  };
}

async function findRetryJob(studentId: string) {
  const retryJobs = await db
    .collection("erasureJobs")
    .where("studentId", "==", studentId)
    .limit(20)
    .get();
  return retryJobs.docs.find((document) => document.get("status") === "retry_required");
}

type ErasureJobSelection = {
  erasureId: string;
  jobRef: DocumentReference | null;
  job: DocumentSnapshot | null;
};

async function createErasureJob(input: ErasureInput): Promise<ErasureJobSelection> {
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
  const job = await jobRef.get();
  return { erasureId, jobRef, job };
}

async function selectErasureJob(input: ErasureInput): Promise<ErasureJobSelection> {
  let erasureId = input.existingErasureId ?? "";
  let jobRef: DocumentReference | null = erasureId
    ? db.collection("erasureJobs").doc(erasureId)
    : null;
  let job: DocumentSnapshot | null = jobRef ? await jobRef.get() : null;
  if (!input.existingErasureId) {
    const retry = await findRetryJob(input.studentId);
    if (retry) {
      erasureId = retry.id;
      jobRef = retry.ref;
      job = retry;
    }
  }
  return { erasureId, jobRef, job };
}

function validateRetryJob(
  selection: ErasureJobSelection,
  studentId: string,
): asserts selection is {
  erasureId: string;
  jobRef: DocumentReference;
  job: DocumentSnapshot;
} {
  const { job, jobRef } = selection;
  if (
    !jobRef ||
    !job ||
    !job.exists ||
    job.get("studentId") !== studentId ||
    job.get("status") !== "retry_required"
  ) {
    throw new Error("ERASURE_JOB_NOT_RETRYABLE");
  }
}

async function resolveErasureContext(input: ErasureInput): Promise<ErasureContext> {
  const studentRef = db.collection("students").doc(input.studentId);
  const selection = await selectErasureJob(input);
  const student = await studentRef.get();
  if (student.exists && student.get("legalHold") === true) throw new Error("ERASURE_LEGAL_HOLD");
  let erasureJob = selection;
  if (!erasureJob.jobRef) {
    if (!student.exists) throw new Error("STUDENT_NOT_FOUND");
    erasureJob = await createErasureJob(input);
  } else {
    validateRetryJob(erasureJob, input.studentId);
  }
  if (!erasureJob.jobRef || !erasureJob.job) throw new Error("ERASURE_JOB_UNAVAILABLE");
  return { studentRef, student, ...erasureJob };
}

async function loadCertificates(studentId: string, jobRef: DocumentReference) {
  try {
    return await db.collection("certificates").where("studentId", "==", studentId).get();
  } catch (error: unknown) {
    await jobRef.set(
      {
        status: "retry_required",
        lastErrorCode: "ERASURE_PREPARATION_FAILED",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }
}

function makeErasurePlan(
  job: DocumentSnapshot,
  certificates: QueryDocumentSnapshot[],
): ErasurePlan {
  return {
    certificates,
    certificateIds: [
      ...new Set([
        ...strings(job.get("certificateIds")),
        ...certificates.map((document) => document.id),
      ]),
    ],
    keys: [
      ...new Set([
        ...strings(job.get("r2Keys")),
        ...certificates.map((document) => String(document.get("r2Key") ?? "")).filter(Boolean),
      ]),
    ],
    hashes: [
      ...new Set([
        ...strings(job.get("sha256s")),
        ...certificates.map((document) => String(document.get("sha256") ?? "")).filter(Boolean),
      ]),
    ],
  };
}

async function markErasureStarted(
  input: ErasureInput,
  context: ErasureContext,
  plan: ErasurePlan,
): Promise<void> {
  await context.jobRef.set(
    {
      status: "started",
      studentId: input.studentId,
      actorUid: input.actorUid,
      reason: input.reason,
      ...(input.dataRightsRequestId ? { dataRightsRequestId: input.dataRightsRequestId } : {}),
      ...(input.requesterEmail ? { requesterEmail: input.requesterEmail } : {}),
      certificateIds: plan.certificateIds,
      r2Keys: plan.keys,
      sha256s: plan.hashes,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  if (context.student.exists)
    await context.studentRef.set(
      {
        erasurePending: true,
        erasureJobId: context.erasureId,
        erasureStartedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

async function markCertificatesPending(certificates: QueryDocumentSnapshot[]): Promise<void> {
  for (let offset = 0; offset < certificates.length; offset += 400) {
    const batch = db.batch();
    for (const certificate of certificates.slice(offset, offset + 400))
      batch.set(certificate.ref, { erasurePending: true }, { merge: true });
    await batch.commit();
  }
}

async function removeKnownStorage(
  studentId: string,
  plan: ErasurePlan,
  counts: ErasureCounts,
): Promise<void> {
  for (const key of plan.keys) {
    if (await deleteR2Object(key)) counts.r2Objects++;
  }
  const sweep = await purgeStudentR2Objects(studentId, plan.hashes);
  counts.r2MetadataMatchedObjects += sweep.deleted;
  if (sweep.ambiguous > 0 || sweep.unattributed > 0)
    throw new Error("ERASURE_STORAGE_RECONCILIATION_REQUIRED");
}

async function deleteCertificateIndexes(
  certificateIds: string[],
  counts: ErasureCounts,
): Promise<void> {
  for (const certificateId of certificateIds) {
    for (const collectionName of CERTIFICATE_INDEXES) {
      const matches = await db
        .collection(collectionName)
        .where("certificateId", "==", certificateId)
        .limit(500)
        .get();
      if (matches.empty) continue;
      const batch = db.batch();
      for (const document of matches.docs) batch.delete(document.ref);
      await batch.commit();
      counts.indexEntries += matches.size;
    }
  }
}

function shouldRedactRelatedRecord(
  collectionName: (typeof RELATED_COLLECTIONS)[number],
  document: QueryDocumentSnapshot,
): boolean {
  return (
    (collectionName === "reports" ||
      collectionName === "supportTickets" ||
      collectionName === "consentLogs") &&
    (document.get("legalHold") === true || document.get("retainForLegalReason") === true)
  );
}

function redactedRelatedRecord(
  collectionName: (typeof RELATED_COLLECTIONS)[number],
  document: QueryDocumentSnapshot,
  erasureId: string,
): Record<string, unknown> {
  const common = {
    retainedForLegalReason: true,
    retentionCategory: "legal_hold",
    erasureId,
    personalDataErasedAt: FieldValue.serverTimestamp(),
    retainedAt: FieldValue.serverTimestamp(),
  };
  if (collectionName === "consentLogs") {
    const policyVersion: unknown = document.get("policyVersion") ?? null;
    const consentTimestamp: unknown = document.get("timestamp") ?? null;
    return { ...common, policyVersion, consentTimestamp };
  }
  return {
    ...common,
    status: document.get("status") === "closed" ? "closed" : "retained",
  };
}

async function deleteRelatedRecords(
  studentId: string,
  erasureId: string,
  counts: ErasureCounts,
): Promise<void> {
  for (const collectionName of RELATED_COLLECTIONS) {
    const matches = await db
      .collection(collectionName)
      .where("studentId", "==", studentId)
      .limit(500)
      .get();
    if (matches.empty) continue;
    const batch = db.batch();
    for (const document of matches.docs) {
      if (shouldRedactRelatedRecord(collectionName, document)) {
        batch.set(document.ref, redactedRelatedRecord(collectionName, document, erasureId));
        counts.legallyRetainedRedactedRecords++;
      } else {
        batch.delete(document.ref);
        counts.relatedRecords++;
      }
    }
    await batch.commit();
  }
}

async function resolveDataRightsRequest(
  requestId: string | undefined,
  erasureId: string,
): Promise<void> {
  if (!requestId) return;
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

async function deleteCertificates(
  certificates: QueryDocumentSnapshot[],
  counts: ErasureCounts,
): Promise<void> {
  for (let offset = 0; offset < certificates.length; offset += 400) {
    const batch = db.batch();
    for (const certificate of certificates.slice(offset, offset + 400))
      batch.delete(certificate.ref);
    await batch.commit();
    counts.firestoreDocuments += Math.min(400, certificates.length - offset);
  }
}

async function hasCertificateIndexes(certificateIds: string[]): Promise<boolean> {
  for (const certificateId of certificateIds) {
    for (const collectionName of CERTIFICATE_INDEXES) {
      const indexes = await db
        .collection(collectionName)
        .where("certificateId", "==", certificateId)
        .limit(1)
        .get();
      if (!indexes.empty) return true;
    }
  }
  return false;
}

async function hasRelatedRecords(studentId: string): Promise<boolean> {
  for (const collectionName of RELATED_COLLECTIONS) {
    const matches = await db
      .collection(collectionName)
      .where("studentId", "==", studentId)
      .limit(1)
      .get();
    if (!matches.empty) return true;
  }
  return false;
}

async function verifyErasure(
  studentId: string,
  context: ErasureContext,
  plan: ErasurePlan,
): Promise<void> {
  const verifyStudent = await context.studentRef.get();
  const verifyCertificates = await db
    .collection("certificates")
    .where("studentId", "==", studentId)
    .limit(1)
    .get();
  const indexRemains = await hasCertificateIndexes(plan.certificateIds);
  const relatedRemains = await hasRelatedRecords(studentId);
  const verifyStorage = await purgeStudentR2Objects(studentId, plan.hashes);
  if (verifyStorage.ambiguous > 0 || verifyStorage.unattributed > 0)
    throw new Error("ERASURE_STORAGE_RECONCILIATION_REQUIRED");
  const verifyReview = await db.collection("retentionReview").doc(studentId).get();
  if (
    verifyStudent.exists ||
    !verifyCertificates.empty ||
    indexRemains ||
    relatedRemains ||
    verifyStorage.deleted > 0 ||
    verifyReview.exists
  )
    throw new Error("ERASURE_VERIFICATION_FAILED");
}

function deletedCounts(counts: ErasureCounts): ErasureCounts {
  return { ...counts };
}

async function completeErasure(
  input: ErasureInput,
  context: ErasureContext,
  counts: ErasureCounts,
): Promise<{ erasureId: string; deletedCounts: ErasureCounts; verified: true }> {
  const receipt = {
    erasureId: context.erasureId,
    action: "student.erasure.complete",
    actorUid: input.actorUid,
    reason: input.reason,
    deletedCounts: deletedCounts(counts),
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
      deletedCounts: deletedCounts(counts),
      verified: true,
    },
    { merge: true },
  );
  return {
    erasureId: context.erasureId,
    deletedCounts: deletedCounts(counts),
    verified: true,
  };
}

async function executeErasure(
  input: ErasureInput,
  context: ErasureContext,
  plan: ErasurePlan,
  counts: ErasureCounts,
): Promise<{ erasureId: string; deletedCounts: ErasureCounts; verified: true }> {
  try {
    await markErasureStarted(input, context, plan);
    await markCertificatesPending(plan.certificates);
    await removeKnownStorage(input.studentId, plan, counts);
    await deleteCertificateIndexes(plan.certificateIds, counts);
    await deleteRelatedRecords(input.studentId, context.erasureId, counts);
    await resolveDataRightsRequest(input.dataRightsRequestId, context.erasureId);
    await deleteCertificates(plan.certificates, counts);
    if (plan.certificates.some((document) => document.get("status") === "published"))
      await rebuildPublicSessions();
    if (context.student.exists) {
      await context.studentRef.delete();
      counts.firestoreDocuments++;
    }
    await db.collection("retentionReview").doc(input.studentId).delete();
    await verifyErasure(input.studentId, context, plan);
    return await completeErasure(input, context, counts);
  } catch (error) {
    await context.jobRef.set(
      {
        status: "retry_required",
        lastErrorCode:
          error instanceof Error && /^ERASURE_[A-Z_]+$/.test(error.message)
            ? error.message
            : "ERASURE_FAILED",
        updatedAt: FieldValue.serverTimestamp(),
        deletedCounts: deletedCounts(counts),
      },
      { merge: true },
    );
    throw error;
  }
}

export function eraseStudentData(
  studentId: string,
  actorUid: string,
  reason: ErasureReason,
  ...metadata: [existingErasureId?: string, dataRightsRequestId?: string, requesterEmail?: string]
): Promise<{ erasureId: string; deletedCounts: ErasureCounts; verified: true }> {
  const [existingErasureId, dataRightsRequestId, requesterEmail] = metadata;
  const input: ErasureInput = {
    studentId,
    actorUid,
    reason,
    ...(existingErasureId ? { existingErasureId } : {}),
    ...(dataRightsRequestId ? { dataRightsRequestId } : {}),
    ...(requesterEmail ? { requesterEmail } : {}),
  };
  return eraseStudentDataInternal(input);
}

async function eraseStudentDataInternal(
  input: ErasureInput,
): Promise<{ erasureId: string; deletedCounts: ErasureCounts; verified: true }> {
  const context = await resolveErasureContext(input);
  const certificates = await loadCertificates(input.studentId, context.jobRef);
  const plan = makeErasurePlan(context.job, certificates.docs);
  const counts = initialCounts(context.job);
  return executeErasure(input, context, plan, counts);
}
