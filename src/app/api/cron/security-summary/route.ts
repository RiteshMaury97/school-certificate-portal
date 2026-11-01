import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { utcDayKey } from "@/server/daily-security-summary";
import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { getR2StorageUsage } from "@/server/r2";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) return false;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const actual = Buffer.from(request.headers.get("authorization") ?? "", "utf8");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: NextRequest) {
  if (!authorized(request))
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  const day = utcDayKey();
  const runRef = db.collection("abuseCounters").doc(`security_summary_sent_${day}`);
  try {
    const reserve = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(runRef);
      const data = snapshot.data() ?? {};
      if (data.sent === true || Number(data.sendingUntil ?? 0) > Date.now()) return false;
      tx.set(runRef, { sendingUntil: Date.now() + 10 * 60_000, date: day }, { merge: true });
      return true;
    });
    if (!reserve)
      return NextResponse.json(
        { ok: true, skipped: true, date: day },
        { headers: { "Cache-Control": "no-store" } },
      );

    const [metrics, open, reviewing, storage, superadmins] = await Promise.all([
      db.collection("abuseCounters").doc(`security_summary_${day}`).get(),
      db.collection("recordReports").where("status", "==", "open").count().get(),
      db.collection("recordReports").where("status", "==", "reviewing").count().get(),
      getR2StorageUsage(),
      db
        .collection("admins")
        .where("role", "==", "superadmin")
        .where("status", "==", "active")
        .get(),
    ]);
    const totals = metrics.data() ?? {};
    const recipients = superadmins.docs
      .map((doc) => String(doc.get("email") ?? "").trim())
      .filter(Boolean);
    if (!recipients.length)
      throw new Error("No active superadmin email recipients are configured.");
    const text = [
      `Daily security summary for ${day}`,
      `Failed sign-ins: ${Number(totals.failedSignIns ?? 0)}`,
      `Account lockouts: ${Number(totals.lockouts ?? 0)}`,
      `Blocked administrator locations: ${Number(totals.blockedLocations ?? 0)}`,
      `Successful uploads today: ${Number(totals.uploads ?? 0)}`,
      `R2 storage used: ${(storage.bytes / 1_000_000_000).toFixed(2)} GB`,
      `Open tickets: ${open.data().count + reviewing.data().count}`,
    ].join("\n");
    await sendMail({ to: recipients, subject: `Daily portal security summary · ${day}`, text });
    await runRef.set({ sent: true, sentAt: new Date(), sendingUntil: 0 }, { merge: true });
    return NextResponse.json({ ok: true, date: day }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await runRef.set({ sendingUntil: 0, lastErrorAt: new Date() }, { merge: true }).catch(() => {});
    console.error(
      "Daily security summary failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { error: "Daily security summary could not be sent." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
