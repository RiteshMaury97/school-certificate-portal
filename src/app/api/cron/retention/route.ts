import { FieldPath, FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { deleteExpiredAdminOtpChallenges } from "@/server/admin-otp";
import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import {
  retentionExpiryFromSession,
  isRetentionExpired,
} from "@/shared/retention-policy";

import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function notify(count: number) {
  if (count === 0) return;
  const siteSettings = await db.collection("siteSettings").doc("main").get();
  const schoolName = String(siteSettings.get("schoolName") ?? "").trim() || "Satyam International School";
  const admins = await db.collection("admins").where("role", "==", "superadmin").limit(10).get();
  const to = admins.docs.map((doc) => String(doc.get("email") ?? "")).filter(Boolean);
  if (to.length) await sendMail({ to, subject: `${schoolName}: certificate retention review required`, text: `${schoolName}: the weekly retention review identified ${count} student record(s) requiring review. No records were deleted. Sign in to the admin area and review the retention queue.` }).catch(() => null);
}
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const otpChallengesDeleted = await deleteExpiredAdminOtpChallenges();
    const settings = await db.collection("siteSettings").doc("main").get();
    if (settings.get("retentionScheduleConfirmed") !== true)
      return NextResponse.json(
        {
          error:
            "The school must confirm the retention schedule in Site branding before the job can run.",
        },
        { status: 409 },
      );
    const years = Math.max(
      1,
      Math.min(30, Number(settings.get("retentionYears") ?? 7)),
    );
    const now = new Date();
    let cursor: QueryDocumentSnapshot | undefined;
    let flagged = 0;
    let scanned = 0;
    while (true) {
      let query = db
        .collection("students")
        .orderBy(FieldPath.documentId())
        .limit(400);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      if (page.empty) break;
      for (const student of page.docs) {
        scanned++;
        const stored = student.get("retentionExpiresAt")?.toDate?.();
        const hasManualExtension =
          typeof student.get("retentionExtensionReason") === "string" &&
          Boolean(student.get("retentionExtensionReason"));
        const expiry =
          hasManualExtension && stored
            ? stored
            : retentionExpiryFromSession(
                String(student.get("session") ?? ""),
                years,
              );
        if (
          !isRetentionExpired(expiry, now) ||
          student.get("legalHold") === true
        )
          continue;
        const ref = db.collection("retentionReview").doc(student.id);
        const existing = await ref.get();
        if (
          existing.exists &&
          ["open", "dismissed", "erasure_complete"].includes(
            String(existing.get("status")),
          )
        )
          continue;
        await ref.set(
          {
            studentId: student.id,
            status: "open",
            retentionExpiresAt: expiry,
            flaggedAt: FieldValue.serverTimestamp(),
            source: "weekly_retention_job",
            reviewReason: "configured_retention_period_elapsed",
          },
          { merge: true },
        );
        flagged++;
      }
      cursor = page.docs[page.docs.length - 1];
      if (page.size < 400) break;
    }
    await notify(flagged);
    await db
      .collection("retentionJobLogs")
      .add({
        scanned,
        flagged,
        deleted: 0,
        createdAt: FieldValue.serverTimestamp(),
        retentionYears: years,
      });
    return NextResponse.json(
      { ok: true, scanned, flagged, deleted: 0, otpChallengesDeleted },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Retention review job failed." },
      { status: 500 },
    );
  }
}
