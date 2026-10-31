import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { db } from "@/server/firebase-admin";

function secret() {
  const value = process.env.NOTIFICATION_OPT_OUT_SECRET;
  if (!value || Buffer.byteLength(value) < 32)
    throw new Error("NOTIFICATION_OPT_OUT_SECRET must be at least 32 bytes.");
  return value;
}
function tokenHash(token: string) {
  return createHmac("sha256", secret()).update(token).digest("hex");
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
  const expiry = snap.get("expiresAt");
  const expiresAt =
    expiry &&
    typeof expiry === "object" &&
    "toMillis" in expiry &&
    typeof expiry.toMillis === "function"
      ? expiry.toMillis()
      : expiry instanceof Date
        ? expiry.getTime()
        : 0;
  if (!snap.exists || snap.get("usedAt") || expiresAt <= Date.now()) return null;
  const studentId = snap.get("studentId");
  return typeof studentId === "string" && studentId ? { studentId, tokenHash: hash } : null;
}
export async function sendCertificateAvailableNotice(studentId: string): Promise<void> {
  const studentRef = db.collection("students").doc(studentId);
  const student = await studentRef.get();
  if (
    !student.exists ||
    student.get("notificationConsent") !== true ||
    student.get("notificationConsentPurpose") !== "certificate_availability" ||
    !student.get("notificationConsentAt") ||
    student.get("notificationOptOut") === true
  )
    return;
  const latestConsent = await studentRef.get();
  if (
    !latestConsent.exists ||
    latestConsent.get("notificationConsent") !== true ||
    latestConsent.get("notificationConsentPurpose") !== "certificate_availability" ||
    !latestConsent.get("notificationConsentAt") ||
    latestConsent.get("notificationOptOut") === true
  )
    return;
  const email = String(latestConsent.get("parentEmail") ?? "").trim();
  const mobile = String(latestConsent.get("parentMobile") ?? "").trim();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL ?? "").replace(
    /\/$/,
    "",
  );
  const siteSettings = await db.collection("siteSettings").doc("main").get();
  const schoolName = String(siteSettings.get("schoolName") || "Satyam International School");
  if (!siteUrl) return;
  const token = await makeOptOutToken(studentId);
  const optOutUrl = `${siteUrl}/api/public/notifications/opt-out?token=${encodeURIComponent(token)}`;
  let sent = false;
  let channel = "none";
  if (email && process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL) {
    channel = "email";
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.NOTIFICATION_FROM_EMAIL,
          to: [email],
          subject: `${schoolName}: your certificate is now available`,
          text: `${schoolName} has made your certificate available at ${siteUrl}. No personal details are included in this message. To stop future notifications, visit: ${optOutUrl}`,
          html: `<p>${schoolName} has made your certificate available at <a href="${siteUrl}">${siteUrl}</a>.</p><p>No personal details are included in this message.</p><p><a href="${optOutUrl}">Opt out of future notifications</a>.</p>`,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      sent = response.ok;
    } catch {
      sent = false;
    }
  }
  if (
    !sent &&
    mobile &&
    process.env.MSG91_AUTH_KEY &&
    process.env.MSG91_TEMPLATE_ID &&
    process.env.MSG91_SENDER_ID
  ) {
    channel = "sms";
    try {
      const response = await fetch("https://control.msg91.com/api/v5/flow/", {
        method: "POST",
        headers: {
          authkey: process.env.MSG91_AUTH_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_id: process.env.MSG91_TEMPLATE_ID,
          sender: process.env.MSG91_SENDER_ID,
          recipients: [
            {
              mobiles: mobile,
              site_url: siteUrl,
              opt_out_url: optOutUrl,
              opt_out_text: "Opt out using this link",
            },
          ],
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      sent = response.ok;
    } catch {
      sent = false;
    }
  }
  await db.collection("notificationLogs").add({
    studentId,
    channel,
    sent,
    purpose: "certificate_available",
    consentTimestamp: latestConsent.get("notificationConsentAt") ?? null,
    createdAt: new Date(),
  });
}
