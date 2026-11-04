import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";

import { assertServerEnvironment } from "./env";
import { db } from "./firebase-admin";
import { hashRequesterIp } from "./security";
import { recordDailySecurityMetric } from "./security-summary";

import type { NextRequest } from "next/server";

const CHALLENGES = "adminOtpChallenges";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function otpSecret(): string {
  assertServerEnvironment();
  const secret = process.env.OTP_HMAC_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("OTP_HMAC_SECRET must contain at least 32 bytes.");
  }
  return secret;
}

export function isAdminOtpLockThresholdReached(failureCount: number): boolean {
  return failureCount >= 5;
}

export function adminOtpRecipient(adminDocument: { email?: unknown }): string {
  const email = adminDocument.email;
  return (typeof email === "string" ? email : "").trim().toLowerCase();
}

export function createAdminOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashAdminOtp(challengeId: string, uid: string, code: string): string {
  return createHmac("sha256", otpSecret())
    .update(`${challengeId}:${uid}:${code}`, "utf8")
    .digest("hex");
}

export function safeHashEqual(expected: string, actual: string): boolean {
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(actual, "hex");
  return left.length === 32 && right.length === 32 && timingSafeEqual(left, right);
}

export function createDeviceHash(request: NextRequest): string {
  const device = request.cookies.get("sis_admin_device")?.value ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  return createHmac("sha256", otpSecret()).update(`${userAgent}|${device}`, "utf8").digest("hex");
}

export function adminEmailLockoutId(email: string): string {
  assertServerEnvironment();
  const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AUDIT_LOG_HMAC_SECRET must contain at least 32 bytes.");
  }
  return createHmac("sha256", secret).update(email.toLowerCase()).digest("hex");
}

export async function isAdminOtpLocked(email: string): Promise<boolean> {
  const snapshot = await db.collection("adminLoginFailures").doc(adminEmailLockoutId(email)).get();
  return Number(snapshot.get("lockedUntil") ?? 0) > Date.now();
}

export async function recordAdminOtpFailure(
  email: string,
  request: NextRequest,
): Promise<{ locked: boolean; count: number }> {
  const ref = db.collection("adminLoginFailures").doc(adminEmailLockoutId(email));
  const now = Date.now();
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = Number(snapshot.get("count") ?? 0);
    const count = previous + 1;
    const locked = isAdminOtpLockThresholdReached(count);
    transaction.set(
      ref,
      {
        count,
        windowStartedAt: Number(snapshot.get("windowStartedAt") ?? now),
        lockedUntil: locked ? now + 15 * MINUTE : Number(snapshot.get("lockedUntil") ?? 0),
        lastIpHash: hashRequesterIp(request),
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(now + 24 * HOUR),
      },
      { merge: true },
    );
    return { locked, count, newlyLocked: locked && previous < 5 };
  });
  if (result.newlyLocked) {
    await recordDailySecurityMetric("lockouts").catch((error: unknown) => {
      console.warn("[admin-otp] Failed to record daily lockout metric.", error);
    });
    const admins = await db.collection("admins").where("role", "==", "superadmin").limit(10).get();
    const { sendMail } = await import("./mailer");
    const recipients = admins.docs.map((doc) => String(doc.get("email") ?? "")).filter(Boolean);
    if (recipients.length) {
      await sendMail({
        to: recipients,
        subject: "School Portal: administrator OTP lock alert",
        text: `An administrator account was locked after repeated email-code failures. Account: ${email}. Attempts: ${String(result.count)}.`,
      }).catch((error: unknown) => {
        console.warn("[admin-otp] Failed to send lock alert.", error);
      });
    }
  }
  return { locked: result.locked, count: result.count };
}

export async function deleteExpiredAdminOtpChallenges(): Promise<number> {
  const snapshot = await db
    .collection(CHALLENGES)
    .where("expiresAt", "<=", new Date())
    .limit(400)
    .get();
  if (snapshot.empty) return 0;
  const batch = db.batch();
  for (const doc of snapshot.docs) batch.delete(doc.ref);
  await batch.commit();
  return snapshot.size;
}

export type OtpVerificationResult = {
  valid: boolean;
  attemptsRemaining: number;
  exhausted: boolean;
};

type OtpTransaction<TReference> = {
  get(reference: TReference): Promise<{ exists: boolean; get(field: string): unknown }>;
  update(reference: TReference, data: Record<string, unknown>): unknown;
};

type TimestampLike = { toMillis(): number };

function isTimestampLike(value: unknown): value is TimestampLike {
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  ) {
    return true;
  }
  return false;
}

function timestampMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (isTimestampLike(value)) return value.toMillis();
  return 0;
}

/** Transactional verification shared by the route and mocked-Firestore tests. */
export async function verifyAdminOtpChallenge<TReference>(
  transaction: OtpTransaction<NoInfer<TReference>>,
  ref: TReference,
  input: { uid: string; challengeId: string; code: string; now?: number },
): Promise<OtpVerificationResult> {
  const snapshot = await transaction.get(ref);
  const now = input.now ?? Date.now();
  const attempts = Number(snapshot.get("attempts") ?? 0);
  const maxAttempts = Number(snapshot.get("maxAttempts") ?? 5);
  if (
    !snapshot.exists ||
    snapshot.get("uid") !== input.uid ||
    snapshot.get("consumedAt") !== null ||
    timestampMillis(snapshot.get("expiresAt")) <= now
  ) {
    return {
      valid: false,
      attemptsRemaining: Math.max(0, maxAttempts - attempts),
      exhausted: false,
    };
  }
  if (attempts >= maxAttempts) {
    transaction.update(ref, { consumedAt: FieldValue.serverTimestamp() });
    return { valid: false, attemptsRemaining: 0, exhausted: true };
  }
  const nextAttempts = attempts + 1;
  const actual = hashAdminOtp(input.challengeId, input.uid, input.code);
  const storedHash = snapshot.get("codeHash");
  const valid = safeHashEqual(typeof storedHash === "string" ? storedHash : "", actual);
  if (valid) {
    transaction.update(ref, { attempts: nextAttempts, verifiedAt: FieldValue.serverTimestamp() });
    return { valid: true, attemptsRemaining: maxAttempts - nextAttempts, exhausted: false };
  }
  transaction.update(ref, {
    attempts: nextAttempts,
    ...(nextAttempts >= maxAttempts ? { consumedAt: FieldValue.serverTimestamp() } : {}),
  });
  return {
    valid: false,
    attemptsRemaining: Math.max(0, maxAttempts - nextAttempts),
    exhausted: nextAttempts >= maxAttempts,
  };
}

export async function consumeVerifiedAdminOtpChallenge<TReference>(
  transaction: OtpTransaction<NoInfer<TReference>>,
  ref: TReference,
  uid: string,
  now = Date.now(),
): Promise<boolean> {
  const snapshot = await transaction.get(ref);
  const verifiedAt = timestampMillis(snapshot.get("verifiedAt"));
  const expiresAt = timestampMillis(snapshot.get("expiresAt"));
  if (
    !snapshot.exists ||
    snapshot.get("uid") !== uid ||
    snapshot.get("consumedAt") !== null ||
    !verifiedAt ||
    now - verifiedAt > 5 * MINUTE ||
    expiresAt <= now
  )
    return false;
  transaction.update(ref, { consumedAt: FieldValue.serverTimestamp() });
  return true;
}

export function canSendAdminOtp(input: {
  lastSentAt: number;
  accountHourlyCount: number;
  ipHourlyCount: number;
  now: number;
}): boolean {
  return (
    input.now - input.lastSentAt >= MINUTE &&
    input.accountHourlyCount < 5 &&
    input.ipHourlyCount < 30
  );
}

export function createAdminOtpChallengeRecord(input: {
  uid: string;
  challengeId: string;
  code: string;
  now: number;
  ipHash: string;
  deviceHash: string;
}) {
  return {
    uid: input.uid,
    codeHash: hashAdminOtp(input.challengeId, input.uid, input.code),
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(input.now + 5 * MINUTE),
    attempts: 0,
    maxAttempts: 5,
    consumedAt: null,
    verifiedAt: null,
    ipHash: input.ipHash,
    deviceHash: input.deviceHash,
  };
}

export function adminOtpChallengeCollection() {
  return db.collection(CHALLENGES);
}
