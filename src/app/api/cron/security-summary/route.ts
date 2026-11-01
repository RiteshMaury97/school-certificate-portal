import { timingSafeEqual } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { getR2StorageBytes } from "@/server/r2";
import { getUploadsToday } from "@/server/upload-policy";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const supplied = Buffer.from(authorization, "utf8");
  return (
    secret.length >= 32 &&
    supplied.length === expected.length &&
    timingSafeEqual(supplied, expected)
  );
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const start = new Date(`${day}T00:00:00.000Z`);
  try {
    const summaryRef = db.collection("abuseCounters").doc(`security_summary_${day}`);
    const [
      metricsSnapshot,
      blockedLocations,
      uploadsToday,
      storageBytes,
      openTickets,
      superadmins,
    ] = await Promise.all([
      summaryRef.get(),
      db
        .collection("auditLogs")
        .where("action", "==", "admin.location.blocked")
        .where("timestamp", ">=", Timestamp.fromDate(start))
        .get(),
      getUploadsToday(),
      getR2StorageBytes(),
      db.collection("recordReports").where("status", "==", "open").count().get(),
      db
        .collection("admins")
        .where("role", "==", "superadmin")
        .where("status", "==", "active")
        .limit(10)
        .get(),
    ]);
    const metrics = metricsSnapshot.data() ?? {};
    const recipients = superadmins.docs
      .map((doc) => String(doc.get("email") ?? "").trim())
      .filter(Boolean);
    if (!recipients.length)
      return NextResponse.json(
        { error: "No active superadmin recipients are configured." },
        { status: 503 },
      );
    const claimed = await db.runTransaction(async (transaction) => {
      const state = await transaction.get(summaryRef);
      if (state.get("emailSent") === true || state.get("emailSending") === true) return false;
      transaction.set(
        summaryRef,
        { day, emailSending: true, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      return true;
    });
    if (!claimed)
      return NextResponse.json({ ok: true, sent: false, reason: "already-sent-or-running" });
    const content = [
      `Daily security summary — ${day} UTC`,
      `Failed sign-ins: ${String(metrics.failedSignIns ?? 0)}`,
      `Lockouts: ${String(metrics.lockouts ?? 0)}`,
      `Blocked locations: ${String(blockedLocations.size)}`,
      `Uploads today: ${String(uploadsToday)}`,
      `R2 storage used: ${String(storageBytes)} bytes`,
      `Open wrong-record reports: ${String(openTickets.data().count)}`,
    ].join("\n");
    try {
      await sendMail({ to: recipients, subject: `Daily security summary — ${day}`, text: content });
      await summaryRef.set(
        { emailSent: true, emailSending: false, emailedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      return NextResponse.json({ ok: true, sent: true, day });
    } catch (error) {
      await summaryRef.set({ emailSending: false }, { merge: true });
      throw error;
    }
  } catch (error) {
    console.error("Daily security summary failed", error);
    return NextResponse.json({ error: "Unable to send daily security summary." }, { status: 500 });
  }
}
