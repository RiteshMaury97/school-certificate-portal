import "server-only";
import { createHmac, randomInt, randomBytes, timingSafeEqual } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminAuth, adminAppCheck, db } from "./firebase-admin";
import { hashRequesterIp } from "./request-origin";
import {
  bindStudentId,
  createCertificateNumberHash as makeCertificateNumberHash,
  createSearchKey as makeSearchKey,
  isWithinRateLimit,
  canConsumeDisambiguationAttempt,
  signStudentAccessToken,
  verifyStudentAccessToken as verifyAccessToken,
} from "./security-primitives";
import {
  signDisambiguationChallenge,
  verifyDisambiguationChallenge,
  type DisambiguationClaims,
} from "./student-pii";
import { isAllowedRequestOrigin } from "../shared/origin-policy";
import { hasAnyRole as hasRole } from "../shared/role-policy";
import { isAdminSessionExpired } from "../shared/session-policy";

import type { NextRequest } from "next/server";

export {
  adminSessionCookieOptions,
  apiError,
  csrfCookieOptions,
} from "./security-api-error";

function requiredSecret(name: string): string {
  const value = process.env[name];
  if (!value || Buffer.byteLength(value, "utf8") < 32) {
    throw new Error(`${name} must be configured with at least 32 bytes`);
  }
  return value;
}

export { hashRequesterIp };

type AuditLogInput = [
  request: NextRequest,
  actorUid: string,
  action: string,
  targetId: string,
  studentId?: string,
  details?: { changedFields?: string[] },
];

export function createSearchKey(input: {
  studentName: string;
  fatherName: string;
  motherName: string;
  className: string;
  scholarNumber: string;
  session: string;
}): string {
  return makeSearchKey(input, requiredSecret("SEARCH_HMAC_SECRET"));
}

export async function writeAuditLog(...args: AuditLogInput): Promise<void> {
  const [request, actorUid, action, targetId, studentId, details] = args;
  const timestamp = FieldValue.serverTimestamp();
  await db.collection("auditLogs").add({
    actorUid,
    action,
    targetId,
    ...(studentId ? { studentId } : {}),
    ...(details?.changedFields?.length ? { changedFields: details.changedFields } : {}),
    ipHash: hashRequesterIp(request),
    timestamp,
  });
  await updateAuditMetrics(action, targetId, timestamp);
}

async function updateAuditMetrics(
  action: string,
  targetId: string,
  timestamp: ReturnType<typeof FieldValue.serverTimestamp>,
): Promise<void> {
  const counters = db.collection("metricsCounters");
  const weeklyId = new Date().toISOString().slice(0, 10);
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
  if (Object.keys(updates).length)
    await counters.doc("portal").set({ ...updates, updatedAt: timestamp }, { merge: true });
  if (action === "certificate.search") {
    await counters.doc(`searches_${weeklyId}`).set(
      {
        date: weeklyId,
        count: FieldValue.increment(1),
        updatedAt: timestamp,
      },
      { merge: true },
    );
  }
}

export async function writeConsentLog(
  request: NextRequest,
  policyVersion: string,
  studentId?: string,
): Promise<void> {
  await db.collection("consentLogs").add({
    ipHash: hashRequesterIp(request),
    ...(studentId ? { studentId } : {}),
    timestamp: FieldValue.serverTimestamp(),
    policyVersion,
    purpose: "certificate_retrieval",
    consentGiven: true,
    collectionPoint: "public_lookup",
    noticeVersion: policyVersion,
  });
}

type Budget = { id: string; limit: number; windowMs: number };
function bucketId(prefix: string, identity: string, windowMs: number, now: number): string {
  return `${prefix}_${identity}_${String(Math.floor(now / windowMs))}`;
}

/**
 * Firestore transaction-based abuse limits. Unlike process memory, these counters
 * are shared by serverless instances. Configure Firestore TTL on expiresAt for cleanup.
 */
async function consumeBudgets(
  request: NextRequest,
  budgets: Budget[],
  lockoutIpHash?: string,
): Promise<boolean> {
  const now = Date.now();
  const refs = budgets.map((item) => db.collection("abuseCounters").doc(item.id));
  const lockoutRef = lockoutIpHash
    ? db.collection("abuseCounters").doc(`miss_state_${lockoutIpHash}`)
    : null;

  return db.runTransaction((transaction) =>
    consumeBudgetTransaction({ transaction, refs, budgets, lockoutRef, now }),
  );
}

async function consumeBudgetTransaction(input: {
  transaction: FirebaseFirestore.Transaction;
  refs: FirebaseFirestore.DocumentReference[];
  budgets: Budget[];
  lockoutRef: FirebaseFirestore.DocumentReference | null;
  now: number;
}): Promise<boolean> {
  const { transaction, refs, budgets, lockoutRef, now } = input;
  const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
  const lockoutSnapshot = lockoutRef ? await transaction.get(lockoutRef) : null;
  const lockoutUntil = Number(lockoutSnapshot?.get("lockoutUntil") ?? 0);
  if (lockoutUntil > now || !budgetsWithinLimits(snapshots, budgets)) return false;
  writeBudgetCounters({ transaction, refs, snapshots, budgets, now });
  return true;
}

function budgetsWithinLimits(
  snapshots: FirebaseFirestore.DocumentSnapshot[],
  budgets: Budget[],
): boolean {
  for (let index = 0; index < budgets.length; index += 1) {
    const budget = budgets[index];
    const snapshot = snapshots[index];
    if (!budget || !snapshot) return false;
    const current = Number(snapshot.get("count") ?? 0);
    if (!isWithinRateLimit(current, budget.limit)) return false;
  }
  return true;
}

function writeBudgetCounters(input: {
  transaction: FirebaseFirestore.Transaction;
  refs: FirebaseFirestore.DocumentReference[];
  snapshots: FirebaseFirestore.DocumentSnapshot[];
  budgets: Budget[];
  now: number;
}): void {
  const { transaction, refs, snapshots, budgets, now } = input;
  for (const [index, budget] of budgets.entries()) {
    const snapshot = snapshots[index];
    const ref = refs[index];
    if (!snapshot || !ref) continue;
    const current = Number(snapshot.get("count") ?? 0);
    transaction.set(
      ref,
      {
        count: current + 1,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(now + budget.windowMs * 2),
      },
      { merge: true },
    );
  }
}

export async function consumeSearchBudget(
  request: NextRequest,
  searchKey?: string,
): Promise<boolean> {
  const now = Date.now();
  const ipHash = hashRequesterIp(request);
  const minute = 60_000;
  const hour = 60 * minute;
  const budgets: Budget[] = [
    {
      id: bucketId("search_ip_min", ipHash, minute, now),
      limit: 5,
      windowMs: minute,
    },
    {
      id: bucketId("search_ip_hour", ipHash, hour, now),
      limit: 20,
      windowMs: hour,
    },
  ];
  if (searchKey) {
    budgets.push(
      {
        id: bucketId("search_key_min", searchKey, minute, now),
        limit: 5,
        windowMs: minute,
      },
      {
        id: bucketId("search_key_hour", searchKey, hour, now),
        limit: 20,
        windowMs: hour,
      },
    );
  }
  return consumeBudgets(request, budgets, ipHash);
}

function disambiguationChallengeSecret(): string {
  return requiredSecret("DISAMBIGUATION_CHALLENGE_SECRET");
}
export function issueDisambiguationChallenge(searchKey: string, ipHash: string): string {
  const now = Math.floor(Date.now() / 1000);
  return signDisambiguationChallenge(
    {
      v: 1,
      sk: searchKey,
      iph: ipHash,
      iat: now,
      exp: now + 120,
      nonce: randomBytes(16).toString("hex"),
    },
    disambiguationChallengeSecret(),
  );
}
export function verifyDisambiguationChallengeToken(
  token: string,
  request: NextRequest,
): DisambiguationClaims | null {
  return verifyDisambiguationChallenge(
    token,
    disambiguationChallengeSecret(),
    hashRequesterIp(request),
  );
}
export async function consumeDisambiguationAttempt(nonce: string): Promise<boolean> {
  const ref = db.collection("abuseCounters").doc(`disambiguation_${nonce}`);
  const now = Date.now();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const count = Number(snapshot.get("count") ?? 0);
    if (!canConsumeDisambiguationAttempt(count, snapshot.get("completed") === true)) return false;
    transaction.set(
      ref,
      {
        count: count + 1,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(now + 10 * 60_000),
      },
      { merge: true },
    );
    return true;
  });
}
export async function completeDisambiguationChallenge(nonce: string): Promise<void> {
  await db
    .collection("abuseCounters")
    .doc(`disambiguation_${nonce}`)
    .set(
      {
        count: 3,
        completed: true,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 10 * 60_000),
      },
      { merge: true },
    );
}

export function createCertificateNumberHash(certificateNumber: string): string {
  return makeCertificateNumberHash(
    certificateNumber,
    requiredSecret("CERTIFICATE_NUMBER_HMAC_SECRET"),
  );
}

export async function consumeVerificationBudget(
  request: NextRequest,
  certificateHash?: string,
): Promise<boolean> {
  const now = Date.now();
  const ipHash = hashRequesterIp(request);
  const minute = 60_000;
  const hour = 60 * minute;
  const budgets: Budget[] = [
    {
      id: bucketId("verify_ip_min", ipHash, minute, now),
      limit: 10,
      windowMs: minute,
    },
    {
      id: bucketId("verify_ip_hour", ipHash, hour, now),
      limit: 60,
      windowMs: hour,
    },
  ];
  if (certificateHash)
    budgets.push(
      {
        id: bucketId("verify_number_min", certificateHash, minute, now),
        limit: 5,
        windowMs: minute,
      },
      {
        id: bucketId("verify_number_hour", certificateHash, hour, now),
        limit: 20,
        windowMs: hour,
      },
    );
  return consumeBudgets(request, budgets, ipHash);
}

export async function recordLookupMiss(request: NextRequest): Promise<void> {
  const ipHash = hashRequesterIp(request);
  const ref = db.collection("abuseCounters").doc(`miss_state_${ipHash}`);
  const now = Date.now();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const windowStart = Number(snapshot.get("missWindowStart") ?? 0);
    const priorMisses =
      windowStart > 0 && now - windowStart < 10 * 60_000 ? Number(snapshot.get("misses") ?? 0) : 0;
    const misses = priorMisses + 1;
    transaction.set(
      ref,
      {
        misses,
        missWindowStart: priorMisses === 0 ? now : windowStart,
        lockoutUntil: misses >= 5 ? now + 15 * 60_000 : Number(snapshot.get("lockoutUntil") ?? 0),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(now + 24 * 60 * 60_000),
      },
      { merge: true },
    );
  });
}

export async function recordLookupSuccess(request: NextRequest): Promise<void> {
  const ipHash = hashRequesterIp(request);
  await db
    .collection("abuseCounters")
    .doc(`miss_state_${ipHash}`)
    .set(
      {
        misses: 0,
        missWindowStart: Date.now(),
        lockoutUntil: 0,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      },
      { merge: true },
    );
}

export async function delayFailedLookup(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 120 + randomInt(180)));
}

type AccessClaims = {
  v: 1;
  sid: string;
  iph: string;
  iat: number;
  exp: number;
  nonce: string;
};

function accessTokenSecret(): string {
  return requiredSecret("CERTIFICATE_ACCESS_TOKEN_SECRET");
}

function studentBinding(studentId: string): string {
  return bindStudentId(studentId, accessTokenSecret());
}

export function issueStudentAccessToken(studentId: string, ipHash: string): string {
  const now = Math.floor(Date.now() / 1000);
  return signStudentAccessToken(
    {
      v: 1,
      sid: studentBinding(studentId),
      iph: ipHash,
      iat: now,
      exp: now + 5 * 60,
      nonce: randomInt(0, 2 ** 31).toString(36),
    },
    accessTokenSecret(),
  );
}

export function verifyStudentAccessToken(token: string, request: NextRequest): AccessClaims | null {
  return verifyAccessToken(token, accessTokenSecret(), hashRequesterIp(request));
}

export function studentAccessTokenOwnsStudent(claims: AccessClaims, studentId: string): boolean {
  return claims.sid === studentBinding(studentId);
}

export type AdminRole = "uploader" | "approver" | "admin" | "superadmin";
export type AdminIdentity = { uid: string; email: string; role: AdminRole };
export function hasAnyRole(admin: AdminIdentity, roles: readonly AdminRole[]): boolean {
  return hasRole(admin.role, roles);
}
export async function requireRoles(
  request: NextRequest,
  roles: readonly AdminRole[],
): Promise<AdminIdentity> {
  const admin = await requireAdmin(request);
  if (!hasAnyRole(admin, roles)) throw new Error("FORBIDDEN");
  return admin;
}

export async function verifyRequestAppCheck(request: NextRequest): Promise<void> {
  // Keep the browser and server policies aligned in local development.
  // The browser SDK deliberately omits an App Check token when no reCAPTCHA
  // site key is configured. In development, mirror that behaviour unless
  // APP_CHECK_ENFORCE=true explicitly opts into testing App Check.
  // Production always requires a valid App Check token.
  if (process.env.NODE_ENV !== "production") {
    if (process.env.APP_CHECK_ENFORCE === "false") return;
    if (
      process.env.APP_CHECK_ENFORCE !== "true" &&
      !process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY
    ) {
      return;
    }
  }
  const token = request.headers.get("x-firebase-appcheck") ?? "";
  if (!token) throw new Error("APP_CHECK");
  try {
    await adminAppCheck.verifyToken(token);
  } catch {
    throw new Error("APP_CHECK");
  }
}

export async function requireAdmin(request: NextRequest): Promise<AdminIdentity> {
  await verifyRequestAppCheck(request);
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !verifyCsrf(request))
    throw new Error("CSRF");
  const session = request.cookies.get("sis_admin_session")?.value;
  if (!session) throw new Error("UNAUTHORIZED");
  const decoded = await adminAuth.verifySessionCookie(session, true);
  const email = decoded.email?.toLowerCase() ?? "";
  if (!email) throw new Error("FORBIDDEN");
  const identity = await verifyAdminAccount(decoded.uid, email, decoded.role);
  await verifyAdminSession(session, identity.uid);
  return identity;
}

function isAdminRole(role: unknown): role is AdminRole {
  return role === "uploader" || role === "approver" || role === "admin" || role === "superadmin";
}

async function verifyAdminAccount(
  uid: string,
  email: string,
  decodedRole: unknown,
): Promise<AdminIdentity> {
  const admin = await db.collection("admins").doc(uid).get();
  const role: unknown = admin.get("role");
  const adminEmail: unknown = admin.get("email");
  const status: unknown = admin.get("status");
  if (
    !admin.exists ||
    // A disabled or still-invited account must not keep working on an old cookie.
    status !== "active" ||
    typeof adminEmail !== "string" ||
    adminEmail.toLowerCase() !== email ||
    !isAdminRole(role) ||
    decodedRole !== role
  )
    throw new Error("FORBIDDEN");
  return { uid, email, role };
}

function timestampMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
}

async function verifyAdminSession(session: string, uid: string): Promise<void> {
  const sessionKey = createHmac("sha256", requiredSecret("AUDIT_LOG_HMAC_SECRET"))
    .update(session)
    .digest("hex");
  const sessionRef = db.collection("adminSessions").doc(sessionKey);
  const sessionSnapshot = await sessionRef.get();
  if (
    !sessionSnapshot.exists ||
    sessionSnapshot.get("uid") !== uid ||
    sessionSnapshot.get("revokedAt")
  ) {
    throw new Error("UNAUTHORIZED");
  }
  const now = Date.now();
  const lastActivity = timestampMillis(sessionSnapshot.get("lastActivityAt"));
  const absoluteExpiry = timestampMillis(sessionSnapshot.get("absoluteExpiresAt"));
  if (isAdminSessionExpired(lastActivity, absoluteExpiry, now)) {
    await sessionRef.set(
      { revokedAt: FieldValue.serverTimestamp(), revokeReason: "timeout" },
      { merge: true },
    );
    throw new Error("UNAUTHORIZED");
  }
}

export async function requireSensitiveReauth(
  request: NextRequest,
  admin: AdminIdentity,
): Promise<void> {
  const token = request.headers.get("x-admin-reauth") ?? "";
  if (token.length < 32) throw new Error("REAUTH_REQUIRED");
  const hash = createHmac("sha256", requiredSecret("AUDIT_LOG_HMAC_SECRET"))
    .update(token)
    .digest("hex");
  const ref = db.collection("adminReauthGrants").doc(hash);
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const expiry = timestampMillis(snap.get("expiresAt"));
    if (!snap.exists || snap.get("uid") !== admin.uid || snap.get("usedAt") || Date.now() > expiry)
      throw new Error("REAUTH_REQUIRED");
    transaction.update(ref, { usedAt: FieldValue.serverTimestamp() });
  });
}

export function verifyCsrf(request: NextRequest): boolean {
  const cookie = request.cookies.get("sis_admin_csrf")?.value ?? "";
  const header = request.headers.get("x-csrf-token") ?? "";
  return (
    cookie.length >= 32 &&
    header.length === cookie.length &&
    timingSafeEqual(Buffer.from(cookie), Buffer.from(header)) &&
    sameOrigin(request)
  );
}

export function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return isAllowedRequestOrigin(
    origin,
    process.env.APP_ORIGIN ?? new URL(request.url).origin,
    process.env.NODE_ENV !== "production",
  );
}
