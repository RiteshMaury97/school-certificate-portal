import { timingSafeEqual } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { absoluteUrl } from "@/server/site-origin";
import {
  BREACH_DEADLINES,
  dueBreachReminderMilestones,
  isBoardReportOverdue,
} from "@/shared/breach-deadlines";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const supplied = request.headers.get("authorization") ?? "";
  const expectedBytes = Buffer.from(`Bearer ${secret}`, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return (
    secret.length >= 32 &&
    suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes)
  );
}

async function claimReminder(id: string, milestone: string): Promise<boolean> {
  const reference = db.collection("abuseCounters").doc(`breach_reminder_${id}_${milestone}`);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists) return false;
    transaction.set(reference, { status: "sending", createdAt: FieldValue.serverTimestamp() });
    return true;
  });
}

function discoveredDate(data: Record<string, unknown>): Date | null {
  const value: unknown = data.discoveredAt ?? data.createdAt;
  const date =
    value instanceof Timestamp
      ? value.toDate()
      : value instanceof Date
        ? value
        : typeof value === "string"
          ? new Date(value)
          : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function adminUrl(): string {
  return absoluteUrl("/admin/breaches");
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const [records, admins] = await Promise.all([
      db.collection("breaches").get(),
      db
        .collection("admins")
        .where("role", "==", "superadmin")
        .where("status", "==", "active")
        .limit(20)
        .get(),
    ]);
    const recipients = admins.docs
      .map((doc) => String(doc.get("email") ?? "").trim())
      .filter(Boolean);
    if (!recipients.length)
      return NextResponse.json(
        { error: "No active superadmin recipients are configured." },
        { status: 503 },
      );
    const sent = await processReminders(records.docs, recipients, new Date());
    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    console.error("Breach reminders failed", error);
    return NextResponse.json({ error: "Unable to process breach reminders." }, { status: 500 });
  }
}

async function sendReminder(input: {
  id: string;
  title: string;
  discoveredAt: Date;
  milestone: string;
  recipients: string[];
}): Promise<boolean> {
  const { id, title, discoveredAt, milestone, recipients } = input;
  if (!(await claimReminder(id, milestone))) return false;
  const deadline =
    milestone === "overdue"
      ? `Overdue: detailed report to the Board (${String(BREACH_DEADLINES.boardDetailedReportHours)} hours after discovery)`
      : milestone === "due-within-30-hours"
        ? `Detailed report to the Board is due within ${String(BREACH_DEADLINES.boardReportPreDeadlineReminderHours)} hours (${new Date(discoveredAt.getTime() + BREACH_DEADLINES.boardDetailedReportHours * 3_600_000).toISOString()})`
        : `${milestone}-hour reminder; detailed report due ${new Date(discoveredAt.getTime() + BREACH_DEADLINES.boardDetailedReportHours * 3_600_000).toISOString()}`;
  const reference = db.collection("abuseCounters").doc(`breach_reminder_${id}_${milestone}`);
  try {
    await sendMail({
      to: recipients,
      subject: `Breach register reminder: ${milestone === "overdue" ? "overdue" : milestone === "due-within-30-hours" ? "due within 30 hours" : `${milestone} hours`}`,
      text: `Incident: ${title}\nDeadline: ${deadline}\nReview: ${adminUrl()}`,
    });
    await reference.set({ status: "sent", sentAt: FieldValue.serverTimestamp() }, { merge: true });
    return true;
  } catch (error) {
    await reference.delete();
    throw error;
  }
}

async function processOne(
  id: string,
  data: Record<string, unknown>,
  recipients: string[],
  now: Date,
): Promise<number> {
  if (data.status === "closed") return 0;
  const discoveredAt = discoveredDate(data);
  if (!discoveredAt) return 0;
  const milestones = dueBreachReminderMilestones(discoveredAt, now);
  const detailedAt =
    data.boardDetailedReportAt instanceof Timestamp
      ? data.boardDetailedReportAt.toDate().toISOString()
      : data.boardDetailedReportAt instanceof Date
        ? data.boardDetailedReportAt.toISOString()
        : typeof data.boardDetailedReportAt === "string"
          ? data.boardDetailedReportAt
          : null;
  if (detailedAt) {
    const dueSoonIndex = milestones.indexOf("due-within-30-hours");
    if (dueSoonIndex >= 0) milestones.splice(dueSoonIndex, 1);
  }
  if (isBoardReportOverdue(discoveredAt, now, detailedAt)) milestones.push("overdue");
  const title = typeof data.title === "string" ? data.title : "Incident record";
  let sent = 0;
  for (const milestone of milestones)
    sent += Number(await sendReminder({ id, title, discoveredAt, milestone, recipients }));
  return sent;
}

async function processReminders(
  records: { id: string; data: () => Record<string, unknown> }[],
  recipients: string[],
  now: Date,
): Promise<number> {
  let sent = 0;
  for (const record of records) sent += await processOne(record.id, record.data(), recipients, now);
  return sent;
}
