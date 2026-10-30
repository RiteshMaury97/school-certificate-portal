import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/src/lib/firebase-admin";
import {
  hashRequesterIp,
  verifyRequestAppCheck,
  sameOrigin,
} from "@/src/lib/security";
export const runtime = "nodejs";
const key = () => {
  const value = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  if (Buffer.byteLength(value) < 32) throw new Error("Missing audit secret");
  return value;
};
async function notifySuperadmins(email: string, count: number) {
  const apiKey = process.env.RESEND_API_KEY,
    from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return;
  const siteSettings = await db.collection("siteSettings").doc("main").get();
  const schoolName = String(siteSettings.get("schoolName") || "Satyam International School");
  const admins = await db
    .collection("admins")
    .where("role", "==", "superadmin")
    .limit(10)
    .get();
  const recipients = admins.docs
    .map((d) => String(d.get("email") ?? ""))
    .filter(Boolean);
  if (!recipients.length) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `${schoolName}: repeated administrator sign-in failures`,
      text: `${schoolName}: repeated sign-in failures detected for an administrator account. Attempts: ${count}. Account identifier: ${email}. The account is temporarily locked for 15 minutes.`,
    }),
  }).catch(() => undefined);
}
export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const body = (await request.json()) as {
      email?: unknown;
      action?: unknown;
    };
    if (
      typeof body.email !== "string" ||
      body.email.length > 254 ||
      !["check", "failure"].includes(String(body.action))
    )
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const email = body.email.trim().toLowerCase();
    const knownAdmin = await db
      .collection("admins")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (knownAdmin.empty) return NextResponse.json({ locked: false });
    const emailHash = createHmac("sha256", key()).update(email).digest("hex");
    const ipHash = hashRequesterIp(request);
    const ref = db.collection("adminLoginFailures").doc(emailHash);
    const now = Date.now();
    if (body.action === "failure") {
      const ipRef = db
        .collection("abuseCounters")
        .doc(`admin_login_fail_${ipHash}_${Math.floor(now / 60_000)}`);
      const allowed = await db.runTransaction(async (tx) => {
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
      if (!allowed)
        return NextResponse.json(
          { error: "Too many sign-in attempts. Try again shortly." },
          { status: 429 },
        );
    }
    const snap = await ref.get();
    const lockedUntil = Number(snap.get("lockedUntil") ?? 0);
    if (body.action === "check") {
      if (lockedUntil > now)
        return NextResponse.json(
          {
            locked: true,
            retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000),
          },
          { status: 423 },
        );
      if (lockedUntil > 0 && lockedUntil <= now)
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
    const nextCount = Number(snap.get("count") ?? 0) + 1;
    const lock = nextCount >= 5;
    await ref.set(
      {
        count: nextCount,
        windowStartedAt: Number(snap.get("windowStartedAt") ?? now),
        lockedUntil: lock ? now + 15 * 60_000 : lockedUntil,
        lastIpHash: ipHash,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(now + 24 * 60 * 60_000),
      },
      { merge: true },
    );
    if (lock && Number(snap.get("count") ?? 0) < 5)
      await notifySuperadmins(email, nextCount);
    return NextResponse.json({ recorded: true, locked: lock });
  } catch {
    return NextResponse.json(
      { error: "Unable to check sign-in status." },
      { status: 500 },
    );
  }
}
