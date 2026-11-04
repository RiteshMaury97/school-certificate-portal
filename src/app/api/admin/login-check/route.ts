import { createHmac } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { requesterIp } from "@/server/request-origin";
import { hashRequesterIp, verifyRequestAppCheck, sameOrigin } from "@/server/security";
import { recordDailySecurityMetric } from "@/server/security-summary";

import type { DocumentReference, DocumentSnapshot } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";

function isLoginCheckBody(
  value: unknown,
): value is { email: string; action: "check" | "failure" } {
  if (typeof value !== "object" || value === null || !("email" in value) || !("action" in value))
    return false;
  return (
    typeof value.email === "string" &&
    value.email.length <= 254 &&
    (value.action === "check" || value.action === "failure")
  );
}

export const runtime = "nodejs";
const key = () => {
  const value = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  if (Buffer.byteLength(value) < 32) throw new Error("Missing audit secret");
  return value;
};
async function notifySuperadmins(email: string, count: number) {
  const admins = await db.collection("admins").where("role", "==", "superadmin").limit(10).get();
  const recipients = admins.docs.map((doc) => String(doc.get("email") ?? "")).filter(Boolean);
  if (recipients.length)
    await sendMail({
      to: recipients,
      subject: "School Portal: repeated administrator sign-in failures",
      text: `Repeated sign-in failures detected. Attempts: ${String(count)}. Account: ${email}.`,
    }).catch(() => null);
}

async function allowFailureAttempt(ipHash: string, now: number): Promise<boolean> {
  const ipRef = db
    .collection("abuseCounters")
    .doc(`admin_login_fail_${ipHash}_${String(Math.floor(now / 60_000))}`);
  return db.runTransaction(async (tx) => {
    const state = await tx.get(ipRef);
    const count = Number(state.get("count") ?? 0);
    if (count >= 20) return false;
    tx.set(
      ipRef,
      {
        count: count + 1,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(now + 2 * 60_000),
      },
      { merge: true },
    );
    return true;
  });
}

async function checkLockStatus(
  ref: DocumentReference,
  now: number,
): Promise<NextResponse> {
  const snap = await ref.get();
  const lockedUntil = Number(snap.get("lockedUntil") ?? 0);
  if (lockedUntil > now)
    return NextResponse.json(
      { locked: true, retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000) },
      { status: 423 },
    );
  if (lockedUntil > 0)
    await ref.set(
      {
        count: 0,
        lockedUntil: 0,
        windowStartedAt: now,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(now + 24 * 60 * 60_000),
      },
      { merge: true },
    );
  return NextResponse.json({ locked: false });
}

async function recordFailure(
  ref: DocumentReference,
  email: string,
  ipHash: string,
  now: number,
): Promise<NextResponse> {
  const snap: DocumentSnapshot = await ref.get();
  const previousCount = Number(snap.get("count") ?? 0);
  const nextCount = previousCount + 1;
  const lock = nextCount >= 5;
  await ref.set(
    {
      count: nextCount,
      windowStartedAt: Number(snap.get("windowStartedAt") ?? now),
      lockedUntil: lock ? now + 15 * 60_000 : Number(snap.get("lockedUntil") ?? 0),
      lastIpHash: ipHash,
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(now + 24 * 60 * 60_000),
    },
    { merge: true },
  );
  await recordDailySecurityMetric("failedSignIns");
  if (lock && previousCount < 5) {
    await recordDailySecurityMetric("lockouts");
    await notifySuperadmins(email, nextCount);
  }
  return NextResponse.json({ recorded: true, locked: lock });
}

export async function POST(request: NextRequest) {
  try {
    if (!requesterIp(request))
      return NextResponse.json(
        { error: "Client network information is unavailable." },
        { status: 503 },
      );
    await verifyRequestAppCheck(request);
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const body: unknown = await request.json();
    if (!isLoginCheckBody(body))
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const email = body.email.trim().toLowerCase();
    const knownAdmin = await db.collection("admins").where("email", "==", email).limit(1).get();
    if (knownAdmin.empty) return NextResponse.json({ locked: false });
    const emailHash = createHmac("sha256", key()).update(email).digest("hex");
    const ipHash = hashRequesterIp(request);
    const ref = db.collection("adminLoginFailures").doc(emailHash);
    const now = Date.now();
    if (body.action === "failure") {
      const allowed = await allowFailureAttempt(ipHash, now);
      if (!allowed)
        return NextResponse.json(
          { error: "Too many sign-in attempts. Try again shortly." },
          { status: 429 },
        );
    }
    return body.action === "check"
      ? await checkLockStatus(ref, now)
      : await recordFailure(ref, email, ipHash, now);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message.replace(/[\\r\\n]/g, " ").slice(0, 180)
        : "Unknown error";
    console.error("[admin/login-check POST]", message);
    if (error instanceof Error && error.message === "APP_CHECK") {
      return NextResponse.json(
        { error: "App verification failed. Reload the page and try again." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "Unable to check sign-in status. Check the server configuration." },
      { status: 503 },
    );
  }
}
