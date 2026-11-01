import "server-only";
import { createHmac, randomBytes } from "node:crypto";

import { Timestamp, type DocumentSnapshot } from "firebase-admin/firestore";

import { db } from "@/server/firebase-admin";
import { escapeHtml, sendMail } from "@/server/mailer";

function secret() {
  const value = process.env.NOTIFICATION_OPT_OUT_SECRET;
  if (!value || Buffer.byteLength(value) < 32)
    throw new Error("NOTIFICATION_OPT_OUT_SECRET must be at least 32 bytes.");
  return value;
}
function tokenHash(token: string) {
  return createHmac("sha256", secret()).update(token).digest("hex");
}
function timestampMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return 0;
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
  const expiresAt = timestampMillis(expiry);
  if (!snap.exists || snap.get("usedAt") || expiresAt <= Date.now()) return null;
  const studentId: unknown = snap.get("studentId");
  return typeof studentId === "string" && studentId ? { studentId, tokenHash: hash } : null;
}

function hasNotificationConsent(student: DocumentSnapshot): boolean {
  return (
    student.exists &&
    student.get("notificationConsent") === true &&
    student.get("notificationConsentPurpose") === "certificate_availability" &&
    Boolean(student.get("notificationConsentAt")) &&
    student.get("notificationOptOut") !== true
  );
}

export async function sendCertificateAvailableNotice(studentId: string): Promise<void> {
  const studentRef = db.collection("students").doc(studentId);
  if (!hasNotificationConsent(await studentRef.get())) return;
  const latestConsent = await studentRef.get();
  if (!hasNotificationConsent(latestConsent)) return;
  const rawEmail: unknown = latestConsent.get("parentEmail");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "").replace(
    /\/$/,
    "",
  );
  const siteSettings = await db.collection("siteSettings").doc("main").get();
  const schoolName =
    String(siteSettings.get("schoolName") ?? "").trim() || "Satyam International School";
  if (!siteUrl) return;
  const token = await makeOptOutToken(studentId);
  const optOutUrl = `${siteUrl}/api/public/notifications/opt-out?token=${encodeURIComponent(token)}`;
  const { sent, channel } = await deliverCertificateNotice(
    email,
    schoolName,
    siteUrl,
    optOutUrl,
  );
  const consentTimestamp: unknown = latestConsent.get("notificationConsentAt");
  await db.collection("notificationLogs").add({
    studentId,
    channel,
    sent,
    purpose: "certificate_available",
    consentTimestamp: consentTimestamp ?? null,
    createdAt: new Date(),
  });
}

async function deliverCertificateNotice(
  email: string,
  schoolName: string,
  siteUrl: string,
  optOutUrl: string,
): Promise<{ sent: boolean; channel: string }> {
  if (!email) return { sent: false, channel: "none" };
  try {
    await sendMail({
      to: email,
      subject: `${schoolName}: your certificate is now available`,
      text: `${schoolName} has made your certificate available at ${siteUrl}. No personal details are included. To stop future notifications, visit: ${optOutUrl}`,
      html: `<p>${escapeHtml(schoolName)} has made your certificate available at <a href="${escapeHtml(siteUrl)}">${escapeHtml(siteUrl)}</a>.</p><p>No personal details are included in this message.</p><p><a href="${escapeHtml(optOutUrl)}">Opt out of future notifications</a>.</p>`,
    });
    return { sent: true, channel: "email" };
  } catch {
    return { sent: false, channel: "email" };
  }
}
