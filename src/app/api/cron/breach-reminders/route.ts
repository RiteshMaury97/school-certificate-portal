import { timingSafeEqual } from "node:crypto";
import { join } from "node:path";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { absoluteUrl } from "@/server/site-origin";
import { SCHOOL_INFO } from "@/lib/school-info";
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

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

type ReminderRecipient = { email: string; name: string };

function recipientDetails(doc: { id: string; get: (field: string) => unknown }): ReminderRecipient | null {
  const email = String(doc.get("email") ?? "").trim();
  if (!email) return null;
  const profile = doc.get("profile");
  const profileName = typeof profile === "object" && profile !== null
    ? [Reflect.get(profile, "preferredName"), Reflect.get(profile, "name")]
    : [];
  const name = [...profileName, doc.get("displayName"), doc.get("fullName"), doc.get("name")]
    .find((value) => typeof value === "string" && value.trim());
  return { email, name: typeof name === "string" ? name.trim() : "School administrator" };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const [records, admins, settings] = await Promise.all([
      db.collection("breaches").get(),
      db
        .collection("admins")
        .where("role", "==", "superadmin")
        .where("status", "==", "active")
        .limit(20)
        .get(),
      db.collection("siteSettings").doc("main").get(),
    ]);
    const recipients = admins.docs.map(recipientDetails).filter((recipient): recipient is ReminderRecipient => Boolean(recipient));
    if (!recipients.length)
      return NextResponse.json(
        { error: "No active superadmin recipients are configured." },
        { status: 503 },
      );
    const site = settings.exists ? settings.data() as Record<string, unknown> : {};
    const school = {
      name: typeof site.schoolName === "string" && site.schoolName.trim() ? site.schoolName.trim() : SCHOOL_INFO.name,
      address: typeof site.address === "string" && site.address.trim() ? site.address.trim() : SCHOOL_INFO.address,
      phone: typeof site.phone === "string" ? site.phone.trim() : SCHOOL_INFO.phone,
      email: typeof site.email === "string" ? site.email.trim() : "",
      board: typeof site.boardName === "string" ? site.boardName.trim() : "",
      affiliation: typeof site.affiliationNumber === "string" ? site.affiliationNumber.trim() : "",
      code: typeof site.schoolCode === "string" ? site.schoolCode.trim() : "",
    };
    const sent = await processReminders(records.docs, recipients, new Date(), school);
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
  recipients: ReminderRecipient[];
  school: { name: string; address: string; phone: string; email: string; board: string; affiliation: string; code: string };
}): Promise<boolean> {
  const { id, title, discoveredAt, milestone, recipients, school } = input;
  if (!(await claimReminder(id, milestone))) return false;
  const deadline =
    milestone === "overdue"
      ? `Overdue: detailed report to the Board (${String(BREACH_DEADLINES.boardDetailedReportHours)} hours after discovery)`
      : milestone === "due-within-30-hours"
        ? `Detailed report to the Board is due within ${String(BREACH_DEADLINES.boardReportPreDeadlineReminderHours)} hours (${new Date(discoveredAt.getTime() + BREACH_DEADLINES.boardDetailedReportHours * 3_600_000).toISOString()})`
        : `${milestone}-hour reminder; detailed report due ${new Date(discoveredAt.getTime() + BREACH_DEADLINES.boardDetailedReportHours * 3_600_000).toISOString()}`;
  const reference = db.collection("abuseCounters").doc(`breach_reminder_${id}_${milestone}`);
  try {
    const subject = `Breach register reminder: ${milestone === "overdue" ? "overdue" : milestone === "due-within-30-hours" ? "due within 30 hours" : `${milestone} hours`}`;
    const url = adminUrl();
    const safeSchool = escapeHtml(school.name);
    const safeTitle = escapeHtml(title);
    const safeDeadline = escapeHtml(deadline);
    const schoolDetails = [
      school.board ? `Affiliated to ${school.board}` : "",
      school.affiliation ? `Affiliation No. ${school.affiliation}` : "",
      school.code ? `School Code ${school.code}` : "",
    ].filter(Boolean);
    const contactDetails = [school.address, school.phone, school.email].filter(Boolean);
    for (const recipient of recipients) {
      const safeRecipient = escapeHtml(recipient.name);
      await sendMail({
        to: recipient.email,
        subject,
        text: `Hello ${recipient.name},\n\nThis is an automated reminder that a security incident is recorded in the ${school.name} breach register. Review the incident, keep its response status current, and submit the detailed report to the Board by the deadline below.\n\nIncident: ${title}\nAction required: ${deadline}\nReview the breach register: ${url}\n\n${school.name}${contactDetails.length ? `\n${contactDetails.join(" · ")}` : ""}`,
        html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f5f4;color:#1b2925;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(subject)} for the school breach register.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f4;padding:28px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #e0e7e3;border-radius:14px;overflow:hidden"><tr><td style="padding:22px 28px;background:#123d32;color:#fff"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="vertical-align:middle;padding-right:14px"><img src="cid:sis-logo@school-portal" width="58" height="58" alt="${safeSchool} logo" style="display:block;width:58px;height:58px;object-fit:contain;background:#fff;border-radius:10px;padding:4px"></td><td style="vertical-align:middle"><div style="font-size:18px;line-height:1.35;font-weight:700">${safeSchool}</div><div style="margin-top:4px;color:#d4e5de;font-size:12px">School security notification</div></td></tr></table></td></tr><tr><td style="padding:30px 28px"><p style="margin:0 0 8px;color:#28745e;font-size:12px;font-weight:700;letter-spacing:1.2px">BREACH REGISTER</p><h1 style="margin:0 0 16px;font-size:23px;line-height:1.3">${escapeHtml(subject)}</h1><p style="margin:0 0 16px;color:#46564f;font-size:15px;line-height:1.65">Hello ${safeRecipient},</p><p style="margin:0 0 20px;color:#46564f;font-size:14px;line-height:1.7">A security incident is recorded in the school breach register. Please review the incident, keep its response status current, and make sure the detailed report is submitted to the Board by the deadline shown here.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border:1px solid #e1e9e5;border-radius:10px;background:#f7faf8"><tr><td style="padding:15px 16px;color:#56645e;font-size:12px;line-height:1.5">INCIDENT<br><strong style="color:#1b2925;font-size:14px">${safeTitle}</strong></td></tr><tr><td style="padding:0 16px 15px;color:#56645e;font-size:12px;line-height:1.5">ACTION REQUIRED<br><strong style="color:#1b2925;font-size:14px">${safeDeadline}</strong></td></tr></table><p style="margin:0 0 22px;color:#46564f;font-size:14px;line-height:1.7">Use the breach register to review incident details, document response actions, and record when the Board report is completed. If the incident is already closed or the report has been filed, update the register so future reminders stop.</p><p style="margin:0 0 24px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#123d32;color:#fff;text-decoration:none;font-size:14px;font-weight:700">Review breach register</a></p><p style="margin:0;color:#718078;font-size:12px;line-height:1.6">If you are not responsible for incident follow-up, notify the school’s security contact and ensure an assigned administrator takes ownership.</p></td></tr><tr><td style="padding:18px 28px;border-top:1px solid #e7ece9;background:#fafcfb;color:#718078;font-size:11px;line-height:1.7"><strong style="color:#56645e">${safeSchool}</strong><br>${contactDetails.map(escapeHtml).join(" · ")}${schoolDetails.length ? `<br>${schoolDetails.map(escapeHtml).join(" · ")}` : ""}<br>Automated security reminder. Please do not reply to this email.</td></tr></table></td></tr></table></body></html>`,
        attachments: [{ filename: "sis-logo.png", path: join(process.cwd(), "public", "android-chrome-192x192.png"), contentType: "image/png", contentDisposition: "inline", cid: "sis-logo@school-portal" }],
      });
    }
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
  recipients: ReminderRecipient[],
  now: Date,
  school: Parameters<typeof sendReminder>[0]["school"],
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
    sent += Number(await sendReminder({ id, title, discoveredAt, milestone, recipients, school }));
  return sent;
}

async function processReminders(
  records: { id: string; data: () => Record<string, unknown> }[],
  recipients: ReminderRecipient[],
  now: Date,
  school: Parameters<typeof sendReminder>[0]["school"],
): Promise<number> {
  let sent = 0;
  for (const record of records) sent += await processOne(record.id, record.data(), recipients, now, school);
  return sent;
}
