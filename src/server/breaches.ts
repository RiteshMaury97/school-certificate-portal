import "server-only";

import {
  FieldValue,
  Timestamp,
  type DocumentReference,
  type DocumentSnapshot,
} from "firebase-admin/firestore";

import { db } from "@/server/firebase-admin";
import {
  breachCauseValues,
  breachClosureError,
  breachDataCategories,
  breachFieldsSchema,
  breachSeverityValues,
  breachStatuses,
  breachUpdateSchema,
  canTransitionBreach,
  type BreachFields,
} from "@/shared/breach-schema";

type BreachRecord = Record<string, unknown>;
type BreachChanges = { [Key in keyof BreachFields]?: BreachFields[Key] | undefined };
type ListFilters = {
  status: string | null;
  severity: string | null;
  start: string | null;
  end: string | null;
  search: string;
  page: number;
  pageSize: number;
};
type OperationResult = { id?: string; error?: string; status?: number; fields?: string[] };

function dateString(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function categoryValues(value: unknown): BreachFields["dataCategories"] {
  if (!Array.isArray(value)) return ["other"];
  const values: BreachFields["dataCategories"] = [];
  for (const item of value) {
    const category = breachDataCategories.find((candidate) => candidate === item);
    if (category) values.push(category);
  }
  return values.length ? values : ["other"];
}

function normalizeRecord(
  id: string,
  value: BreachRecord,
  leadFallback = "legacy-unknown",
): BreachFields & { id: string; createdAt: string | null; legacy?: boolean } {
  const oldCategory = typeof value.affectedData === "string" ? value.affectedData : "other";
  const categories = categoryValues(value.dataCategories ?? [oldCategory]);
  const status = breachStatuses.find((item) => item === value.status);
  const discoveredAt =
    dateString(value.discoveredAt ?? value.createdAt) ?? new Date(0).toISOString();
  return {
    id,
    title: stringValue(value.title, "Legacy breach record"),
    summary: stringValue(value.summary, "Legacy incident details require review."),
    occurredAt: dateString(value.occurredAt),
    discoveredAt,
    howDiscovered: stringValue(value.howDiscovered, "Not recorded in legacy entry"),
    cause: breachCauseValues.find((item) => item === value.cause) ?? "other",
    dataCategories: categories,
    systemsAffected: stringValue(value.systemsAffected, ""),
    affectedPrincipalsEstimate:
      typeof value.affectedPrincipalsEstimate === "number" ? value.affectedPrincipalsEstimate : 0,
    involvesMinors: value.involvesMinors === true,
    severity: breachSeverityValues.find((item) => item === value.severity) ?? "medium",
    containmentActions: stringValue(value.containmentActions, ""),
    likelyConsequences: stringValue(value.likelyConsequences, ""),
    incidentLead: stringValue(value.incidentLead ?? value.createdBy, leadFallback),
    status: status ?? "reported",
    boardNotifiedAt: dateString(value.boardNotifiedAt),
    boardDetailedReportAt: dateString(value.boardDetailedReportAt),
    principalsNotifiedAt: dateString(value.principalsNotifiedAt),
    boardNotificationNotRequiredReason: stringValue(value.boardNotificationNotRequiredReason, ""),
    affectedPeopleNotificationNotRequiredReason: stringValue(
      value.affectedPeopleNotificationNotRequiredReason,
      "",
    ),
    boardDetailedReportNotRequiredReason: stringValue(
      value.boardDetailedReportNotRequiredReason,
      "",
    ),
    closedAt: dateString(value.closedAt),
    rootCause: stringValue(value.rootCause, ""),
    correctiveActions: stringValue(value.correctiveActions, ""),
    lessonsLearned: stringValue(value.lessonsLearned, ""),
    notificationExceptionReason: stringValue(value.notificationExceptionReason, ""),
    createdAt: dateString(value.createdAt),
    ...(value.legacy === true ? { legacy: true } : {}),
  };
}

export async function listBreaches(
  filters: ListFilters,
): Promise<{ breaches: BreachRecord[]; total: number }> {
  const [current, legacy] = await Promise.all([
    db.collection("breaches").get(),
    db.collection("breachLogs").get(),
  ]);
  const currentIds = new Set(current.docs.map((doc) => doc.id));
  const records: BreachRecord[] = [
    ...current.docs.map((doc) => normalizeRecord(doc.id, doc.data())),
    ...legacy.docs
      .filter((doc) => !currentIds.has(doc.id))
      .map((doc) => ({ ...normalizeRecord(doc.id, doc.data()), legacy: true })),
  ];
  const start = filters.start ? Date.parse(filters.start) : null;
  const end = filters.end ? Date.parse(filters.end) : null;
  const filtered = records
    .filter((record) => matchesFilters(record, filters, start, end))
    .sort(
      (left, right) =>
        Date.parse(String(right.discoveredAt)) - Date.parse(String(left.discoveredAt)),
    );
  const offset = (filters.page - 1) * filters.pageSize;
  return { breaches: filtered.slice(offset, offset + filters.pageSize), total: filtered.length };
}

function matchesFilters(
  record: BreachRecord,
  filters: ListFilters,
  start: number | null,
  end: number | null,
): boolean {
  if (filters.status && record.status !== filters.status) return false;
  if (filters.severity && record.severity !== filters.severity) return false;
  const discovered =
    Date.parse(typeof record.discoveredAt === "string" ? record.discoveredAt : "") || 0;
  if (start !== null && discovered < start) return false;
  if (end !== null && discovered > end) return false;
  return matchesSearch(record, filters.search);
}

function matchesSearch(record: BreachRecord, search: string): boolean {
  const query = search.toLocaleLowerCase();
  if (!query) return true;
  const content = `${stringValue(record.title, "")} ${stringValue(record.summary, "")} ${stringValue(record.id, "")}`;
  return content.toLocaleLowerCase().includes(query);
}

function toStorage(data: BreachFields): BreachRecord {
  return {
    title: data.title,
    summary: data.summary,
    occurredAt: data.occurredAt ? new Date(data.occurredAt) : null,
    discoveredAt: new Date(data.discoveredAt),
    howDiscovered: data.howDiscovered,
    cause: data.cause,
    dataCategories: data.dataCategories,
    systemsAffected: data.systemsAffected,
    affectedPrincipalsEstimate: data.affectedPrincipalsEstimate,
    involvesMinors: data.involvesMinors,
    severity: data.severity,
    containmentActions: data.containmentActions,
    likelyConsequences: data.likelyConsequences,
    incidentLead: data.incidentLead,
    status: data.status,
    boardNotifiedAt: data.boardNotifiedAt ? new Date(data.boardNotifiedAt) : null,
    boardDetailedReportAt: data.boardDetailedReportAt ? new Date(data.boardDetailedReportAt) : null,
    principalsNotifiedAt: data.principalsNotifiedAt ? new Date(data.principalsNotifiedAt) : null,
    boardNotificationNotRequiredReason: data.boardNotificationNotRequiredReason,
    affectedPeopleNotificationNotRequiredReason: data.affectedPeopleNotificationNotRequiredReason,
    boardDetailedReportNotRequiredReason: data.boardDetailedReportNotRequiredReason,
    closedAt: data.closedAt ? new Date(data.closedAt) : null,
    rootCause: data.rootCause,
    correctiveActions: data.correctiveActions,
    lessonsLearned: data.lessonsLearned,
    notificationExceptionReason: data.notificationExceptionReason,
  };
}

async function appendUpdate(
  id: string,
  uid: string,
  note: string,
  statusChange: string | null,
): Promise<void> {
  await db
    .collection("breaches")
    .doc(id)
    .collection("updates")
    .add({ at: FieldValue.serverTimestamp(), byUid: uid, note, statusChange });
}

export async function createBreach(input: unknown, uid: string): Promise<OperationResult> {
  const parsed = breachFieldsSchema.safeParse(input);
  if (!parsed.success) return { error: "Provide all required incident details.", status: 400 };
  if (parsed.data.status !== "reported")
    return { error: "New incidents must start in reported status.", status: 400 };
  const ref = await db.collection("breaches").add({
    ...toStorage(parsed.data),
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await appendUpdate(ref.id, uid, "Incident created", null);
  return { id: ref.id, fields: Object.keys(parsed.data) };
}

function transitionError(
  currentStatus: BreachFields["status"],
  desiredStatus: BreachFields["status"] | undefined,
): OperationResult | null {
  if (!desiredStatus || desiredStatus === currentStatus) return null;
  if (canTransitionBreach(currentStatus, desiredStatus)) return null;
  return {
    error: `Incident status can only move from ${currentStatus} to the next stage.`,
    status: 409,
  };
}

function closureError(status: unknown, data: BreachFields): OperationResult | null {
  if (status !== "closed") return null;
  const error = breachClosureError(data);
  return error ? { error, status: 400 } : null;
}

async function readExistingBreach(id: string) {
  const reference = db.collection("breaches").doc(id);
  const currentSnapshot = await reference.get();
  if (currentSnapshot.exists) return { reference, snapshot: currentSnapshot, legacy: false };
  const legacySnapshot = await db.collection("breachLogs").doc(id).get();
  return { reference, snapshot: legacySnapshot, legacy: legacySnapshot.exists };
}

function validateBreachUpdate(
  previous: BreachFields,
  changes: BreachChanges,
): { data?: BreachFields; error?: string; status?: number } {
  const transition = transitionError(previous.status, changes.status);
  if (transition) {
    return {
      error: transition.error ?? "Incident status transition is not allowed.",
      status: transition.status ?? 409,
    };
  }
  const parsed = breachFieldsSchema.safeParse({
    ...previous,
    ...changes,
    status: changes.status ?? previous.status,
  });
  if (!parsed.success) return { error: "Incident details are invalid.", status: 400 };
  const closure = closureError(changes.status, parsed.data);
  return closure
    ? {
        error: closure.error ?? "Incident closure requirements are incomplete.",
        status: closure.status ?? 400,
      }
    : { data: parsed.data };
}

async function migrateLegacy(
  reference: DocumentReference,
  snapshot: DocumentSnapshot,
  data: BreachFields,
) {
  const createdAt: unknown = snapshot.get("createdAt");
  await reference.set(
    {
      ...toStorage(data),
      createdBy: data.incidentLead,
      createdAt: createdAt ?? FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function persistUpdate(input: {
  id: string;
  uid: string;
  reference: DocumentReference;
  snapshot: DocumentSnapshot;
  legacy: boolean;
  previous: BreachFields;
  updated: BreachFields;
  changes: BreachChanges;
}): Promise<string[]> {
  const { id, uid, reference, snapshot, legacy, previous, updated, changes } = input;
  if (legacy) await migrateLegacy(reference, snapshot, previous);
  const fields = Object.keys(changes);
  const changedStatus =
    changes.status && changes.status !== previous.status
      ? `${previous.status}->${changes.status}`
      : null;
  const closeDate =
    changes.status === "closed"
      ? changes.closedAt
        ? new Date(changes.closedAt)
        : new Date()
      : undefined;
  await reference.set(
    {
      ...toStorage(updated),
      ...(closeDate ? { closedAt: closeDate } : {}),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    },
    { merge: true },
  );
  await appendUpdate(id, uid, `Updated fields: ${fields.join(", ")}`, changedStatus);
  return fields;
}

export async function updateBreach(
  id: string,
  input: unknown,
  uid: string,
): Promise<OperationResult> {
  const parsed = breachUpdateSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid incident update.", status: 400 };
  const { id: updateId, note, ...changes } = parsed.data;
  if (updateId !== id) return { error: "Incident ID mismatch.", status: 400 };
  const existing = await readExistingBreach(id);
  const { reference, snapshot, legacy: isLegacy } = existing;
  if (!snapshot.exists) return { error: "Incident not found.", status: 404 };
  const previous = normalizeRecord(id, snapshot.data() ?? {}, uid);
  if (note && Object.keys(changes).length === 0) {
    await appendUpdate(id, uid, note, null);
    return { id, fields: ["note"] };
  }
  return persistParsedUpdate({
    id,
    uid,
    ...(note ? { note } : {}),
    changes,
    previous,
    reference,
    snapshot,
    legacy: isLegacy,
  });
}

async function persistParsedUpdate(input: {
  id: string;
  uid: string;
  note?: string;
  changes: BreachChanges;
  previous: BreachFields;
  reference: DocumentReference;
  snapshot: DocumentSnapshot;
  legacy: boolean;
}): Promise<OperationResult> {
  const { id, uid, note, changes, previous, reference, snapshot, legacy } = input;
  const validated = validateBreachUpdate(previous, changes);
  if (validated.error || !validated.data)
    return {
      error: validated.error ?? "Incident details are invalid.",
      status: validated.status ?? 400,
    };
  const fields = await persistUpdate({
    id,
    uid,
    reference,
    snapshot,
    legacy,
    previous,
    updated: validated.data,
    changes,
  });
  if (note) await appendUpdate(id, uid, note, null);
  return { id, fields: [...fields, ...(note ? ["note"] : [])] };
}
