import { randomUUID } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { after } from "next/server";

import {
  adminOtpChallengeCollection,
  createAdminOtpCode,
  createDeviceHash,
  deleteExpiredAdminOtpChallenges,
  isAdminOtpLocked,
  canSendAdminOtp,
  createAdminOtpChallengeRecord,
  adminOtpRecipient,
} from "@/server/admin-otp";
import { adminAuth, db, describeFirebaseError } from "@/server/firebase-admin";
import { sendAdminOtpEmail } from "@/server/mailer";
import {
  hashRequesterIp,
  sameOrigin,
  verifyRequestAppCheck,
  writeAuditLog,
} from "@/server/security";

import type { NextRequest} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const minuteMs = 60_000;
const hourMs = 60 * minuteMs;

type SendBody = { idToken?: unknown };

function retrySeconds(input: {
  lastSentAt: number;
  accountHourlyCount: number;
  ipHourlyCount: number;
  now: number;
}): number {
  const cooldown = Math.max(0, Math.ceil((minuteMs - (input.now - input.lastSentAt)) / 1000));
  const hourlyLimit = input.accountHourlyCount >= 5 || input.ipHourlyCount >= 30;
  const nextHour = hourlyLimit
    ? Math.max(1, Math.ceil((hourMs - (input.now % hourMs)) / 1000))
    : 0;
  return Math.max(1, cooldown, nextHour);
}

async function releaseFailedOtpReservation(input: {
  accountMinute: FirebaseFirestore.DocumentReference;
  accountHour: FirebaseFirestore.DocumentReference;
  ipHour: FirebaseFirestore.DocumentReference;
  now: number;
}): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const [minute, account, ip] = await Promise.all([
      transaction.get(input.accountMinute),
      transaction.get(input.accountHour),
      transaction.get(input.ipHour),
    ]);
    if (Number(minute.get("lastSentAt") ?? 0) === input.now)
      transaction.delete(input.accountMinute);
    for (const snapshot of [account, ip]) {
      if (snapshot.exists) {
        const count = Number(snapshot.get("count") ?? 0);
        transaction.update(snapshot.ref, { count: Math.max(0, count - 1) });
      }
    }
  });
}

function validBody(value: unknown): value is SendBody & { idToken: string } {
  return typeof value === "object" && value !== null &&
    "idToken" in value && typeof value.idToken === "string" &&
    value.idToken.length > 0;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await verifyRequestAppCheck(request);
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const body: unknown = await request.json();
    if (!validBody(body)) return NextResponse.json({ error: "Unable to send verification code." }, { status: 400 });

    const decoded = await adminAuth.verifyIdToken(body.idToken, true);
    const email = decoded.email?.trim().toLowerCase() ?? "";
    const adminRef = db.collection("admins").doc(decoded.uid);
    const admin = await adminRef.get();
    const role = admin.get("role");
    const storedEmail = adminOtpRecipient({ email: admin.get("email") });
    if (
      !decoded.email_verified || !email || !admin.exists ||
      admin.get("mustChangePassword") === true || decoded.mustChangePassword === true ||
      !["active", "invited"].includes(String(admin.get("status"))) ||
      storedEmail !== email ||
      !["uploader", "approver", "admin", "superadmin"].includes(String(role)) ||
      decoded.role !== role
    ) return NextResponse.json({ error: "Unable to send verification code." }, { status: 403 });

    if (await isAdminOtpLocked(email)) {
      await writeAuditLog(request, decoded.uid, "otp.locked", decoded.uid);
      return NextResponse.json({ error: "Unable to send verification code." }, { status: 423 });
    }

    const now = Date.now();
    const ipHash = hashRequesterIp(request);
    const deviceHash = createDeviceHash(request);
    const challengeId = randomUUID();
    const code = createAdminOtpCode();
    const challengeRef = adminOtpChallengeCollection().doc(challengeId);
    const accountMinute = db.collection("abuseCounters").doc(`otp_account_cooldown_${decoded.uid}`);
    const accountHour = db.collection("abuseCounters").doc(`otp_account_hour_${decoded.uid}_${Math.floor(now / 3_600_000)}`);
    const ipHour = db.collection("abuseCounters").doc(`otp_ip_hour_${ipHash}_${Math.floor(now / 3_600_000)}`);
    const blockedForSeconds = await db.runTransaction(async (transaction) => {
      const [minuteSnap, hourSnap, ipSnap, previous] = await Promise.all([
        transaction.get(accountMinute), transaction.get(accountHour),
        transaction.get(ipHour),
        transaction.get(adminOtpChallengeCollection().where("uid", "==", decoded.uid).where("consumedAt", "==", null)),
      ]);
      const minuteCount = Number(minuteSnap.get("count") ?? 0);
      const hourCount = Number(hourSnap.get("count") ?? 0);
      const ipCount = Number(ipSnap.get("count") ?? 0);
      const lastSentAt = Number(minuteSnap.get("lastSentAt") ?? 0);
      if (!canSendAdminOtp({ lastSentAt, accountHourlyCount: hourCount, ipHourlyCount: ipCount, now }))
        return retrySeconds({ lastSentAt, accountHourlyCount: hourCount, ipHourlyCount: ipCount, now });
      for (const doc of previous.docs) transaction.update(doc.ref, { consumedAt: FieldValue.serverTimestamp() });
      transaction.set(accountMinute, { count: minuteCount + 1, lastSentAt: now, expiresAt: new Date(now + 2 * 60_000) }, { merge: true });
      transaction.set(accountHour, { count: hourCount + 1, expiresAt: new Date(now + 2 * 60 * 60_000) }, { merge: true });
      transaction.set(ipHour, { count: ipCount + 1, expiresAt: new Date(now + 2 * 60 * 60_000) }, { merge: true });
      transaction.create(challengeRef, createAdminOtpChallengeRecord({
        uid: decoded.uid, challengeId, code, now, ipHash, deviceHash,
      }));
      return 0;
    });
    if (blockedForSeconds > 0)
      return NextResponse.json(
        {
          error: `A verification code was recently sent or the hourly send limit was reached. Try again in ${String(blockedForSeconds)} seconds.`,
          retryAfterSeconds: blockedForSeconds,
        },
        {
          status: 429,
          headers: { "Cache-Control": "no-store", "Retry-After": String(blockedForSeconds) },
        },
      );

    const site = await db.collection("siteSettings").doc("main").get();
    const schoolName = String(site.get("schoolName") ?? "").trim() || "Satyam International School";
    try {
      await sendAdminOtpEmail({ to: storedEmail, code, schoolName });
    } catch {
      await challengeRef.delete();
      await releaseFailedOtpReservation({ accountMinute, accountHour, ipHour, now });
      throw new Error("MAIL_DELIVERY_FAILED");
    }
    // Email delivery has succeeded. Audit logging must not turn a successful
    // delivery into a false 401 response (which would leave the user without
    // the challengeId needed to verify the code).
    await writeAuditLog(request, decoded.uid, "otp.sent", challengeId).catch((auditError: unknown) => {
      console.error("[admin/otp/send audit]", describeFirebaseError(auditError));
    });
    after(() => deleteExpiredAdminOtpChallenges().catch((cleanupError: unknown) => {
      console.error("[admin/otp/send cleanup]", describeFirebaseError(cleanupError));
    }));
    return NextResponse.json({ challengeId, resendAfterSeconds: 60 }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message === "APP_CHECK") {
      return NextResponse.json({ error: "App verification failed." }, { status: 403 });
    }

    const code = String((error as { code?: unknown } | null)?.code ?? "");
    const authFailure = code.startsWith("auth/");
    // Keep the detailed cause in server logs only. The previous implementation
    // converted every exception (SMTP, missing secrets, Firestore outages, etc.)
    // into HTTP 401, incorrectly making infrastructure failures look like bad
    // credentials.
    console.error("[admin/otp/send]", describeFirebaseError(error));

    if (authFailure) {
      return NextResponse.json(
        { error: "Your sign-in session is invalid or expired. Sign in again." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: "The verification email could not be sent. Check the server email and security configuration, then try again." },
      { status: 503 },
    );
  }
}
