import "server-only";

import { join } from "node:path";

import nodemailer from "nodemailer";

import { assertServerEnvironment } from "@/server/env";
import { db } from "@/server/firebase-admin";
import { absoluteUrl } from "@/server/site-origin";

import type { SendMailOptions } from "nodemailer";

export type MailInput = {
  to: string | string[];
  replyTo?: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: SendMailOptions["attachments"];
};

const SCHOOL_LOGO_CID = "sis-logo@school-portal";

function schoolLogoAttachment(): NonNullable<SendMailOptions["attachments"]>[number] {
  return {
    filename: "sis-logo.png",
    path: join(process.cwd(), "public", "android-chrome-192x192.png"),
    contentType: "image/png",
    contentDisposition: "inline",
    cid: SCHOOL_LOGO_CID,
  };
}

const DAILY_RECIPIENT_LIMIT = 500;
const WARN_RECIPIENT_LIMIT = 400;
const SMTP_TIMEOUT_MS = 10_000;

let transport: ReturnType<typeof nodemailer.createTransport> | undefined;

function cleanHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export function escapeHtml(value: unknown): string {
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

function getTransport(): ReturnType<typeof nodemailer.createTransport> {
  assertServerEnvironment();
  const user = process.env.GMAIL_USER?.trim();
  const password = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!user || !password) {
    throw new Error(
      "Email delivery is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD using a Google App Password.",
    );
  }
  if (transport) return transport;
  transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: password },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
  return transport;
}

async function reserveDailyRecipients(recipientCount: number): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.collection("abuseCounters").doc(`gmail_recipients_${day}`);
  const total = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = Number(snapshot.get("count") ?? 0);
    if (current + recipientCount > DAILY_RECIPIENT_LIMIT) {
      throw new Error("Daily Gmail recipient limit reached. Try again tomorrow.");
    }
    const next = current + recipientCount;
    transaction.set(
      ref,
      {
        count: next,
        date: day,
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
      { merge: true },
    );
    return next;
  });
  if (total >= WARN_RECIPIENT_LIMIT) {
    console.warn(
      `[mailer] Gmail daily recipient usage is ${String(total)}/${String(DAILY_RECIPIENT_LIMIT)}.`,
    );
  }
}

async function schoolName(): Promise<string> {
  try {
    const settings = await db.collection("siteSettings").doc("main").get();
    const configured = String(settings.get("schoolName") ?? "").trim();
    if (configured) return configured;
  } catch {
    /* Fall back to configured mail identity when site settings are unavailable. */
  }
  const configuredName = process.env.GMAIL_FROM_NAME?.trim();
  if (!configuredName || configuredName.length === 0) return "Satyam International School";
  return configuredName;
}

function senderAddress(): string {
  const address = process.env.GMAIL_USER?.trim();
  if (!address) {
    throw new Error("Email delivery is not configured. Set GMAIL_USER.");
  }
  return address;
}

function replyToAddress(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const address = cleanHeader(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) ? address : undefined;
}

type SchoolContactInput = {
  boardName?: string;
  affiliationNumber?: string;
  schoolCode?: string;
  address?: string;
  phone?: string;
  email?: string;
};

function schoolDetails(input: SchoolContactInput): string[] {
  return [
    input.boardName?.trim() ? `Affiliated to ${input.boardName.trim()}` : "",
    input.affiliationNumber?.trim() ? `Affiliation No. ${input.affiliationNumber.trim()}` : "",
    input.schoolCode?.trim() ? `School Code ${input.schoolCode.trim()}` : "",
  ].filter(Boolean);
}

function schoolContactDetails(input: SchoolContactInput): string[] {
  return [input.address?.trim(), input.phone?.trim(), input.email?.trim()].filter(
    (value): value is string => Boolean(value),
  );
}

async function otpSchoolName(value: string | undefined): Promise<string> {
  const provided = value?.trim();
  return provided === undefined || provided === "" ? await schoolName() : provided;
}

function adminRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    uploader: "Records uploader",
    approver: "Certificate approver",
    admin: "Administrator",
    superadmin: "Super administrator",
  };
  return labels[role] ?? role;
}

export async function sendMail({ to, subject, text, html, replyTo, attachments }: MailInput): Promise<void> {
  const recipients = (Array.isArray(to) ? to : [to])
    .map((address) => cleanHeader(address))
    .filter(Boolean);
  if (!recipients.length) throw new Error("Email requires at least one recipient.");
  if (!text && !html) throw new Error("Email requires text or HTML content.");

  const name = cleanHeader(await schoolName()).replace(/["\\]/g, "");
  const from = `"${name}" <${cleanHeader(senderAddress())}>`;
  const safeSubject = cleanHeader(subject);
  const safeReplyTo = replyToAddress(replyTo);
  const smtp = getTransport();
  await reserveDailyRecipients(recipients.length);

  const options: SendMailOptions = {
    from,
    to: recipients,
    ...(safeReplyTo ? { replyTo: safeReplyTo } : {}),
    subject: safeSubject,
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
    ...(attachments?.length ? { attachments } : {}),
  };
  await smtp.sendMail(options);
}

export async function sendAdminOtpEmail(input: {
  to: string;
  code: string;
  schoolName?: string;
  tagline?: string;
  boardName?: string;
  affiliationNumber?: string;
  schoolCode?: string;
  address?: string;
  phone?: string;
  email?: string;
}): Promise<void> {
  const name = await otpSchoolName(input.schoolName);
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(input.code);
  const tagline = input.tagline?.trim() ?? "";
  const details = schoolDetails(input);
  const contactDetails = schoolContactDetails(input);
  const portalUrl = absoluteUrl("/admin/login");
  const safeTagline = escapeHtml(tagline);
  const safeDetails = details.map(escapeHtml);
  const safeContactDetails = contactDetails.map(escapeHtml);
  const safePortalUrl = escapeHtml(portalUrl);
  const safeRecipient = escapeHtml(input.to);
  const message: MailInput = {
    to: input.to,
    subject: `${cleanHeader(name)} | Administrator sign-in code`,
    attachments: [schoolLogoAttachment()],
    text: [
      name,
      tagline,
      "ADMINISTRATOR SIGN-IN",
      "",
      `Your verification code is: ${input.code}`,
      "This code expires in 5 minutes and can be used only once.",
      "Never share this code with anyone. The school will never ask you to read it out or forward it.",
      "",
      `Requested for: ${input.to}`,
      `Sign in: ${portalUrl}`,
      "",
      "If you did not request this code, do not use it. Secure your account by resetting your password and contact the school administrator.",
      ...details,
      ...contactDetails,
    ]
      .filter(Boolean)
      .join("\n"),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f5f4;color:#1b2925;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">Your ${safeName} administrator sign-in code expires in 5 minutes.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f4;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e0e7e3;border-radius:16px;overflow:hidden"><tr><td style="padding:26px 32px;background:#123d32;color:#ffffff"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="vertical-align:middle;padding-right:16px"><img src="cid:${SCHOOL_LOGO_CID}" width="60" height="60" alt="${safeName} logo" style="display:block;width:60px;height:60px;object-fit:contain;background:#ffffff;border-radius:12px;padding:5px"></td><td style="vertical-align:middle"><div style="font-size:18px;line-height:1.35;font-weight:700">${safeName}</div>${tagline ? `<div style="margin-top:5px;color:#d4e5de;font-size:13px;line-height:1.4">${safeTagline}</div>` : ""}</td></tr></table></td></tr><tr><td style="padding:32px"><p style="margin:0 0 8px;color:#28745e;font-size:12px;font-weight:700;letter-spacing:1.4px">SECURE ACCOUNT ACCESS</p><h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#1b2925">Administrator sign-in code</h1><p style="margin:0 0 22px;color:#56645e;font-size:15px;line-height:1.6">Use this one-time code to finish signing in to the ${safeName} administration portal.</p><div style="margin:0 0 20px;padding:22px 16px;border:1px solid #dce8e2;border-radius:12px;background:#f6faf8;text-align:center"><div style="margin-bottom:8px;color:#56645e;font-size:12px;font-weight:600;letter-spacing:1px">YOUR VERIFICATION CODE</div><div style="color:#123d32;font-family:Arial,Helvetica,sans-serif;font-size:34px;font-weight:700;letter-spacing:9px;line-height:1.3">${safeCode}</div></div><p style="margin:0 0 18px;color:#56645e;font-size:14px;line-height:1.6">This code expires in <strong style="color:#1b2925">5 minutes</strong> and can be used only once.</p><div style="margin:0 0 22px;padding:14px 16px;border-left:4px solid #d28a24;border-radius:4px;background:#fff8eb;color:#614719;font-size:13px;line-height:1.6"><strong>Keep this code private.</strong> ${safeName} will never ask you to share it by phone, email, or message.</div><p style="margin:0 0 8px;color:#56645e;font-size:13px;line-height:1.6">Requested for <strong style="color:#1b2925">${safeRecipient}</strong></p><p style="margin:0 0 24px;color:#56645e;font-size:13px;line-height:1.6">If you did not request this code, ignore this email and secure your account by resetting your password.</p><a href="${safePortalUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#123d32;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">Open administrator sign-in</a></td></tr>${safeDetails.length ? `<tr><td style="padding:0 32px 20px;color:#56645e;font-size:12px;line-height:1.7">${safeDetails.join("<br>")}</td></tr>` : ""}<tr><td style="padding:20px 32px;border-top:1px solid #e7ece9;background:#fafcfb;color:#718078;font-size:11px;line-height:1.7">${safeContactDetails.length ? `${safeContactDetails.join(" · ")}<br>` : ""}This is an automated security email. Please do not reply with your verification code.</td></tr></table><p style="margin:14px 0 0;color:#8b9690;font-size:11px;line-height:1.5">${safeName} · Administrator account security</p></td></tr></table></body></html>`,
  };

  try {
    await sendMail(message);
  } catch (error) {
    const missingConfig =
      error instanceof Error && /GMAIL_USER|GMAIL_APP_PASSWORD/.test(error.message);
    if (process.env.NODE_ENV !== "production" && missingConfig) {
      console.warn(
        "[mailer] DEVELOPMENT FALLBACK — Gmail is not configured. Admin OTP:",
        input.code,
      );
      return;
    }
    throw error;
  }
}

export async function sendAdminInvitationEmail(input: {
  to: string;
  role: string;
  temporaryPassword: string;
  verificationLink: string;
  schoolName: string;
  recipientName?: string;
  tagline?: string;
  boardName?: string;
  affiliationNumber?: string;
  schoolCode?: string;
  address?: string;
  phone?: string;
  email?: string;
}): Promise<void> {
  const name = input.schoolName.trim() || "Satyam International School";
  const recipientName = input.recipientName?.trim() ?? "";
  const roleLabel = adminRoleLabel(input.role);
  const details = schoolDetails(input);
  const contacts = schoolContactDetails(input);
  const portalUrl = absoluteUrl("/admin/login");
  const safeLogoUrl = `cid:${SCHOOL_LOGO_CID}`;
  const safeName = escapeHtml(name);
  const safeRecipientName = escapeHtml(recipientName);
  const safeRole = escapeHtml(roleLabel);
  const safeEmail = escapeHtml(input.to);
  const safePassword = escapeHtml(input.temporaryPassword);
  const safeVerificationLink = escapeHtml(input.verificationLink);
  const safePortalUrl = escapeHtml(portalUrl);
  const safeTagline = escapeHtml(input.tagline?.trim() ?? "");
  const safeDetails = details.map(escapeHtml);
  const safeContacts = contacts.map(escapeHtml);

  await sendMail({
    to: input.to,
    subject: `${cleanHeader(name)} | Your administrator invitation`,
    attachments: [schoolLogoAttachment()],
    text: [
      `Hello${recipientName ? ` ${recipientName}` : ""},`,
      "",
      `You have been invited to join ${name} as a ${roleLabel}.`,
      `Account: ${input.to}`,
      `Role: ${roleLabel}`,
      "",
      "1. Verify your email using this link:",
      input.verificationLink,
      "",
      "2. Sign in with your account email and temporary password:",
      input.temporaryPassword,
      portalUrl,
      "",
      "3. Choose a new password. You must replace the temporary password before administrator access is enabled.",
      "",
      "Keep this temporary password private. If you were not expecting this invitation, contact the school using the details below and do not sign in.",
      ...details,
      ...contacts,
    ]
      .filter(Boolean)
      .join("\n"),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f5f4;color:#1b2925;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">You have been invited to the ${safeName} administrator portal. Verify your email to get started.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f4;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e0e7e3;border-radius:16px;overflow:hidden"><tr><td style="padding:26px 32px;background:#123d32;color:#ffffff"><table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="vertical-align:middle;padding-right:16px"><img src="${safeLogoUrl}" width="60" height="60" alt="${safeName} logo" style="display:block;width:60px;height:60px;object-fit:contain;background:#ffffff;border-radius:12px;padding:5px"></td><td style="vertical-align:middle"><div style="font-size:18px;line-height:1.35;font-weight:700">${safeName}</div>${input.tagline?.trim() ? `<div style="margin-top:5px;color:#d4e5de;font-size:13px;line-height:1.4">${safeTagline}</div>` : ""}</td></tr></table></td></tr><tr><td style="padding:32px"><p style="margin:0 0 8px;color:#28745e;font-size:12px;font-weight:700;letter-spacing:1.4px">STAFF ACCOUNT SETUP</p><h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#1b2925">You’re invited to join the school portal</h1><p style="margin:0 0 22px;color:#56645e;font-size:15px;line-height:1.6">${recipientName ? `Hello ${safeRecipientName}, ` : "Hello, "}you’ve been invited to access the ${safeName} administration portal.</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;border:1px solid #e1e9e5;border-radius:10px;background:#f7faf8"><tr><td style="padding:14px 16px;color:#56645e;font-size:13px;line-height:1.6">ACCOUNT<br><strong style="color:#1b2925">${safeEmail}</strong></td><td style="padding:14px 16px;color:#56645e;font-size:13px;line-height:1.6">ASSIGNED ROLE<br><strong style="color:#1b2925">${safeRole}</strong></td></tr></table><h2 style="margin:0 0 14px;font-size:17px;color:#1b2925">Complete these steps</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="32" style="vertical-align:top;padding:2px 10px 16px 0;color:#28745e;font-size:15px;font-weight:700">1</td><td style="padding:0 0 16px;color:#56645e;font-size:14px;line-height:1.6"><strong style="color:#1b2925">Verify your email</strong><br>Confirm that this address belongs to you before signing in.</td></tr><tr><td width="32" style="vertical-align:top;padding:2px 10px 16px 0;color:#28745e;font-size:15px;font-weight:700">2</td><td style="padding:0 0 16px;color:#56645e;font-size:14px;line-height:1.6"><strong style="color:#1b2925">Sign in with your temporary password</strong><br>Use the password below for your first sign-in.</td></tr><tr><td width="32" style="vertical-align:top;padding:2px 10px 16px 0;color:#28745e;font-size:15px;font-weight:700">3</td><td style="padding:0 0 18px;color:#56645e;font-size:14px;line-height:1.6"><strong style="color:#1b2925">Create a new password</strong><br>You must replace the temporary password before administrator access is enabled.</td></tr></table><div style="margin:0 0 20px;padding:16px;border:1px solid #ead9b7;border-radius:10px;background:#fff9ed"><div style="margin-bottom:8px;color:#74551f;font-size:11px;font-weight:700;letter-spacing:1px">TEMPORARY PASSWORD</div><div style="color:#302719;font-family:monospace;font-size:15px;line-height:1.6;overflow-wrap:anywhere;word-break:break-all">${safePassword}</div></div><div style="margin:0 0 22px;padding:14px 16px;border-left:4px solid #d28a24;border-radius:4px;background:#fff8eb;color:#614719;font-size:13px;line-height:1.6"><strong>Keep this password private.</strong> Do not forward this email or share the password. Choose a new password immediately after signing in.</div><p style="margin:0 0 12px;color:#56645e;font-size:13px;line-height:1.6">The verification link is intended for you and may expire. If it has expired, return to the sign-in page to request another.</p><p style="margin:0 0 14px"><a href="${safeVerificationLink}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#123d32;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">Verify your email</a></p><p style="margin:0 0 24px"><a href="${safePortalUrl}" style="color:#28745e;font-size:13px;font-weight:700">Open administrator sign-in</a></p><p style="margin:0;color:#718078;font-size:12px;line-height:1.6">If you were not expecting this invitation, do not use the password or verification link. Contact the school using a trusted contact method.</p></td></tr>${safeDetails.length ? `<tr><td style="padding:0 32px 20px;color:#56645e;font-size:12px;line-height:1.7">${safeDetails.join("<br>")}</td></tr>` : ""}<tr><td style="padding:20px 32px;border-top:1px solid #e7ece9;background:#fafcfb;color:#718078;font-size:11px;line-height:1.7">${safeContacts.length ? `${safeContacts.join(" · ")}<br>` : ""}This is an automated account invitation from ${safeName}. Please do not reply with your password.</td></tr></table><p style="margin:14px 0 0;color:#8b9690;font-size:11px;line-height:1.5">${safeName} · Staff account setup</p></td></tr></table></body></html>`,
  });
}
