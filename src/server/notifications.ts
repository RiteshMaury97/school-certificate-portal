import "server-only";
import { createHmac, randomBytes } from "node:crypto";

import { assertServerEnvironment } from "@/server/env";
import { db } from "@/server/firebase-admin";
import { escapeHtml, sendMail } from "@/server/mailer";
import { absoluteUrl } from "@/server/site-origin";

import type { DocumentSnapshot } from "firebase-admin/firestore";

function secret() {
  assertServerEnvironment();
  const value = process.env.NOTIFICATION_OPT_OUT_SECRET;
  if (!value || Buffer.byteLength(value) < 32)
    throw new Error("NOTIFICATION_OPT_OUT_SECRET must be at least 32 bytes.");
  return value;
}

function tokenHash(token: string) {
  return createHmac("sha256", secret()).update(token).digest("hex");
}

function safeText(value: unknown): string {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint" ||
    typeof value === "symbol"
  )
    return String(value);
  return "";
}

function isTimestamp(value: unknown): value is { toMillis: () => number } {
  return (
    value !== null &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  );
}

export async function makeOptOutToken(studentId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db
    .collection("notificationOptOutTokens")
    .doc(tokenHash(token))
    .set({
      studentId,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });
  return token;
}

export async function verifyOptOutToken(
  token: string,
): Promise<{ studentId: string; tokenHash: string } | null> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const hash = tokenHash(token);
  const snap = await db.collection("notificationOptOutTokens").doc(hash).get();
  const expiry: unknown = snap.get("expiresAt");
  const expiresAt = isTimestamp(expiry)
    ? expiry.toMillis()
    : expiry instanceof Date
      ? expiry.getTime()
      : 0;
  if (!snap.exists || snap.get("usedAt") || expiresAt <= Date.now()) return null;
  const studentId: unknown = snap.get("studentId");
  return typeof studentId === "string" && studentId ? { studentId, tokenHash: hash } : null;
}

function hasCurrentNotificationConsent(student: DocumentSnapshot): boolean {
  return (
    student.exists &&
    student.get("notificationConsent") === true &&
    student.get("notificationConsentPurpose") === "certificate_availability" &&
    Boolean(student.get("notificationConsentAt")) &&
    student.get("notificationOptOut") !== true
  );
}

async function getEligibleStudent(studentId: string): Promise<DocumentSnapshot | null> {
  const studentRef = db.collection("students").doc(studentId);
  const initialStudent = await studentRef.get();
  if (!hasCurrentNotificationConsent(initialStudent)) return null;
  const currentStudent = await studentRef.get();
  return hasCurrentNotificationConsent(currentStudent) ? currentStudent : null;
}

async function sendAvailabilityEmail(
  email: string,
  schoolName: string,
  siteUrl: string,
  optOutUrl: string,
): Promise<boolean> {
  try {
    await sendMail({
      to: email,
      subject: `${schoolName}: your certificate is now available`,
      text: `${schoolName} has made your certificate available at ${siteUrl}. No personal details are included. To stop future notifications, visit: ${optOutUrl}`,
      html: `<p>${escapeHtml(schoolName)} has made your certificate available at <a href="${escapeHtml(siteUrl)}">${escapeHtml(siteUrl)}</a>.</p><p>No personal details are included in this message.</p><p><a href="${escapeHtml(optOutUrl)}">Opt out of future notifications</a>.</p>`,
    });
    return true;
  } catch {
    return false;
  }
}

export async function sendCertificateAvailableNotice(studentId: string): Promise<void> {
  const latestConsent = await getEligibleStudent(studentId);
  if (!latestConsent) return;
  const email = String(latestConsent.get("parentEmail") ?? "").trim();
  const siteUrl = absoluteUrl("/");
  const siteSettings = await db.collection("siteSettings").doc("main").get();
  const configuredSchoolName: unknown = siteSettings.get("schoolName");
  const schoolName = safeText(configuredSchoolName).trim() || "Satyam International School";
  const token = await makeOptOutToken(studentId);
  const optOutUrl = absoluteUrl(
    `/api/public/notifications/opt-out?token=${encodeURIComponent(token)}`,
  );
  let sent = false;
  let channel = "none";
  if (email) {
    channel = "email";
    sent = await sendAvailabilityEmail(email, schoolName, siteUrl, optOutUrl);
  }
  const consentTimestamp: unknown = latestConsent.get("notificationConsentAt") ?? null;
  await db.collection("notificationLogs").add({
    studentId,
    channel,
    sent,
    purpose: "certificate_available",
    consentTimestamp,
    createdAt: new Date(),
  });
}
