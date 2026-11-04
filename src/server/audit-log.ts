import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/server/firebase-admin";

type AuditMetadata = {
  changedFields?: string[];
  details?: Record<string, unknown>;
};

function metricUpdates(action: string, targetId: string): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  if (action === "certificate.search") updates.searchesTotal = FieldValue.increment(1);
  if (action === "certificate.verify") updates.verificationChecks = FieldValue.increment(1);
  if (
    action === "certificate.search" &&
    [
      "no_match",
      "no_certificates",
      "no_certificates",
      "invalid_request",
      "rate_limited",
      "search_key_rate_limited",
      "turnstile_failed",
      "internal_error",
      "failed",
    ].includes(targetId)
  )
    updates.failedLookups = FieldValue.increment(1);
  if (action === "certificate.upload") updates.totalCertificates = FieldValue.increment(1);
  if (action === "student.create") updates.totalStudents = FieldValue.increment(1);
  if (action === "student.delete") updates.totalStudents = FieldValue.increment(-1);
  if (action === "certificate.delete") updates.totalCertificates = FieldValue.increment(-1);
  return updates;
}

async function writeMetricCounters(
  action: string,
  targetId: string,
  timestamp: FirebaseFirestore.FieldValue,
): Promise<void> {
  const counters = db.collection("metricsCounters");
  const weeklyId = new Date().toISOString().slice(0, 10);
  const updates = metricUpdates(action, targetId);
  if (Object.keys(updates).length)
    await counters.doc("portal").set({ ...updates, updatedAt: timestamp }, { merge: true });
  if (action === "certificate.search")
    await counters.doc(`searches_${weeklyId}`).set(
      {
        date: weeklyId,
        count: FieldValue.increment(1),
        updatedAt: timestamp,
      },
      { merge: true },
    );
}

export async function persistAuditLog(
  actorUid: string,
  action: string,
  targetId: string,
  studentId: string | undefined,
  metadata: AuditMetadata | undefined,
  ipHash: string,
): Promise<void> {
  const timestamp = FieldValue.serverTimestamp();
  await db.collection("auditLogs").add({
    actorUid,
    action,
    targetId,
    ...(studentId ? { studentId } : {}),
    ...(metadata?.changedFields?.length ? { changedFields: metadata.changedFields } : {}),
    ...(metadata?.details ? { details: metadata.details } : {}),
    ipHash,
    timestamp,
  });
  await writeMetricCounters(action, targetId, timestamp);
}
