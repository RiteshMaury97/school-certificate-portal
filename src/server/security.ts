import "server-only";
import { createHmac, randomInt, randomBytes, timingSafeEqual } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse, type NextRequest } from "next/server";

import { requireRequesterIp } from "./request-origin";
import { assertServerEnvironment } from "./env";
import { adminAuth, adminAppCheck, db, describeFirebaseError } from "./firebase-admin";
import {
  bindStudentId,
  createCertificateNumberHash as makeCertificateNumberHash,
  createSearchKey as makeSearchKey,
  isWithinRateLimit,
  canConsumeDisambiguationAttempt,
  hashRequesterIpValue,
  signStudentAccessToken,
  verifyStudentAccessToken as verifyAccessToken,
} from "./security-primitives";
import {
  signDisambiguationChallenge,
  verifyDisambiguationChallenge,
  type DisambiguationClaims,
} from "./student-pii";
import { isAllowedRequestOrigin } from "../shared/origin-policy";
import { getAllowedOrigins } from "@/server/site-origin";
import { hasAnyRole as hasRole } from "../shared/role-policy";
import { ADMIN_HARD_SESSION_LIMIT_MS, isAdminSessionExpired } from "../shared/session-policy";

function requiredSecret(name: string): string {
  assertServerEnvironment();
  const value = process.env[name];
  if (!value || Buffer.byteLength(value, "utf8") < 32) {
    throw new Error(`${name} must be configured with at least 32 bytes`);
  }
  return value;
}
export function hashRequesterIp(request: NextRequest): string {
  return hashRequesterIpValue(requireRequesterIp(request), requiredSecret("AUDIT_LOG_HMAC_SECRET"));
}
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
export async function writeAuditLog(
  request: NextRequest,
  actorUid: string,
  action: string,
  ...details: [string, string?, { changedFields?: string[]; details?: Record<string, unknown> }?]
): Promise<void> {
  const [targetId, studentId, metadata] = details;
  const timestamp = FieldValue.serverTimestamp();
  await db.collection("auditLogs").add({
    actorUid,
    action,
    targetId,
    ...(studentId ? { studentId } : {}),
    ...(metadata?.changedFields?.length ? { changedFields: metadata.changedFields } : {}),
    ...(metadata?.details ? { details: metadata.details } : {}),
    ipHash: hashRequesterIp(request),
    timestamp,
  });
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
  return `${prefix}_${identity}_${Math.floor(now / windowMs).toString()}`;
}
/**
 * Firestore transaction-based abuse limits. Unlike process memory, these counters
 * are shared by serverless instances. Configure Firestore TTL on expiresAt for cleanup.
 */
function hasBudgetRoom(budgets: Budget[], snapshots: { get(key: string): unknown }[]): boolean {
  return budgets.every((budget, index) => {
    const snapshot = snapshots[index];
    if (!snapshot) return false;
    const current = Number(snapshot.get("count") ?? 0);
    return isWithinRateLimit(current, budget.limit);
  });
}

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
  return db.runTransaction(async (transaction) => {
    const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const lockoutSnapshot = lockoutRef ? await transaction.get(lockoutRef) : null;
    const lockoutUntil = Number(lockoutSnapshot?.get("lockoutUntil") ?? 0);
    if (lockoutUntil > now) return false;
    if (!hasBudgetRoom(budgets, snapshots)) return false;
    for (const [index, budget] of budgets.entries()) {
      const ref = refs[index];
      if (!ref) return false;
      const current = Number(snapshots[index]?.get("count") ?? 0);
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
    return true;
  });
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
function isAdminRole(value: unknown): value is AdminRole {
  return (
    value === "uploader" || value === "approver" || value === "admin" || value === "superadmin"
  );
}
function readStringField(value: { get(key: string): unknown }, key: string): string | undefined {
  const field = value.get(key);
  return typeof field === "string" ? field : undefined;
}

function readUnknownField(source: object, key: string): unknown {
  return Reflect.get(source, key);
}

function callKnownMethod(fn: unknown, thisArg: object): unknown {
  if (typeof fn !== "function") return undefined;
  return Function.prototype.apply.call(fn, thisArg, []);
}

function readTimestampMs(value: { get(key: string): unknown }, key: string): number {
  const field = value.get(key);
  if (typeof field !== "object" || field === null) return 0;
  const toDate = readUnknownField(field, "toDate");
  const date = callKnownMethod(toDate, field);
  if (typeof date !== "object" || date === null) return 0;
  const getTime = readUnknownField(date, "getTime");
  const timestamp = callKnownMethod(getTime, date);
  return typeof timestamp === "number" ? timestamp : 0;
}
function isAuthorizedAdmin(
  admin: { exists: boolean; get(key: string): unknown },
  email: string,
  role: string | undefined,
  decodedRole: string,
): boolean {
  const status = readStringField(admin, "status");
  const adminEmail = readStringField(admin, "email");
  return (
    admin.exists &&
    status === "active" &&
    adminEmail?.toLowerCase() === email &&
    isAdminRole(role) &&
    decodedRole === role
  );
}

function hasActiveAdminSession(
  sessionSnapshot: { exists: boolean; get(key: string): unknown },
  uid: string,
): boolean {
  const sessionUid = readStringField(sessionSnapshot, "uid");
  return sessionSnapshot.exists && sessionUid === uid && !sessionSnapshot.get("revokedAt");
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
  const admin = await db.collection("admins").doc(decoded.uid).get();
  const role = readStringField(admin, "role");
  const decodedRole = typeof decoded.role === "string" ? decoded.role : "";
  if (!isAdminRole(role) || !isAuthorizedAdmin(admin, email, role, decodedRole))
    throw new Error("FORBIDDEN");
  const sessionKey = createHmac("sha256", requiredSecret("AUDIT_LOG_HMAC_SECRET"))
    .update(session)
    .digest("hex");
  const sessionRef = db.collection("adminSessions").doc(sessionKey);
  const sessionSnapshot = await sessionRef.get();
  if (!hasActiveAdminSession(sessionSnapshot, decoded.uid)) throw new Error("UNAUTHORIZED");
  const now = Date.now();
  const lastActivity = readTimestampMs(sessionSnapshot, "lastActivityAt");
  const absoluteExpiry = readTimestampMs(sessionSnapshot, "absoluteExpiresAt");
  if (isAdminSessionExpired(lastActivity, absoluteExpiry, now)) {
    await sessionRef.set(
      { revokedAt: FieldValue.serverTimestamp(), revokeReason: "timeout" },
      { merge: true },
    );
    throw new Error("UNAUTHORIZED");
  }
  return { uid: decoded.uid, email, role };
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
    const expiry = readTimestampMs(snap, "expiresAt");
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
export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: Math.floor(ADMIN_HARD_SESSION_LIMIT_MS / 1000),
  };
}
export function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: Math.floor(ADMIN_HARD_SESSION_LIMIT_MS / 1000),
  };
}
export function apiError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const code =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const invalidSessionCodes = new Set([
    "auth/argument-error",
    "auth/id-token-expired",
    "auth/id-token-revoked",
    "auth/invalid-id-token",
    "auth/invalid-session-cookie",
    "auth/session-cookie-expired",
    "auth/session-cookie-revoked",
    "auth/user-disabled",
    "auth/user-not-found",
  ]);
  if (message === "UNAUTHORIZED" || invalidSessionCodes.has(code)) {
    const response = NextResponse.json({ error: "Authentication required" }, { status: 401 });
    response.cookies.set("sis_admin_session", "", {
      ...adminSessionCookieOptions(),
      maxAge: 0,
    });
    response.cookies.set("sis_admin_csrf", "", {
      ...csrfCookieOptions(),
      maxAge: 0,
    });
    return response;
  }
  const responses = new Map<string, { error: string; status: number }>([
    ["Security scan unavailable, try again", { error: "Security scan unavailable, try again", status: 503 }],
    ["Malware detected; upload blocked", { error: "Malware detected; upload blocked", status: 422 }],
    ["File failed security checks", { error: "File failed security checks", status: 422 }],
    [
      "REAUTH_REQUIRED",
      { error: "Re-authentication with password and email code is required.", status: 428 },
    ],
    ["FORBIDDEN", { error: "Administrator access required", status: 403 }],
    ["CSRF", { error: "CSRF validation failed", status: 403 }],
    ["APP_CHECK", { error: "App verification failed", status: 403 }],
    [
      "ERASURE_STORAGE_RECONCILIATION_REQUIRED",
      {
        error:
          "Legacy R2 objects need manual ownership reconciliation before erasure can be confirmed. No other student's objects were deleted.",
        status: 409,
      },
    ],
    [
      "ERASURE_JOB_NOT_RETRYABLE",
      { error: "This erasure job is not in a retryable state.", status: 409 },
    ],
    ["STUDENT_NOT_FOUND", { error: "Student record not found.", status: 404 }],
    [
      "ERASURE_LEGAL_HOLD",
      {
        error:
          "A legal or statutory retention hold prevents erasure. The School must review the obligation before proceeding.",
        status: 409,
      },
    ],
  ]);
  const response = responses.get(message);
  if (response) return NextResponse.json({ error: response.error }, { status: response.status });
  console.error("[Admin API request failed]", describeFirebaseError(error));
  return NextResponse.json(
    {
      error:
        process.env.NODE_ENV === "development" && error instanceof Error
          ? error.message
          : "The request could not be completed",
    },
    { status: 500 },
  );
}
export function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  return isAllowedRequestOrigin(
    origin,
    getAllowedOrigins(),
    process.env.NODE_ENV !== "production",
  );
}
