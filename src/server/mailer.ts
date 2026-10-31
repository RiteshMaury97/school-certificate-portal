import "server-only";

import nodemailer from "nodemailer";

import { db } from "@/server/firebase-admin";

import type { SendMailOptions } from "nodemailer";

export type MailInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
};

const DAILY_RECIPIENT_LIMIT = 500;
const WARN_RECIPIENT_LIMIT = 400;
const SMTP_TIMEOUT_MS = 10_000;

let transport: nodemailer.Transporter | undefined;

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

function getTransport(): nodemailer.Transporter {
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
    transaction.set(ref, {
      count: next,
      date: day,
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    }, { merge: true });
    return next;
  });
  if (total >= WARN_RECIPIENT_LIMIT) {
    console.warn(`[mailer] Gmail daily recipient usage is ${total}/${DAILY_RECIPIENT_LIMIT}.`);
  }
}

async function schoolName(): Promise<string> {
  const configured = process.env.GMAIL_FROM_NAME?.trim();
  if (configured) return configured;
  try {
    const settings = await db.collection("siteSettings").doc("main").get();
    return String(settings.get("schoolName") ?? "").trim() || "Satyam International School";
  } catch {
    return "Satyam International School";
  }
}

function senderAddress(): string {
  const address = process.env.GMAIL_USER?.trim();
  if (!address) {
    throw new Error("Email delivery is not configured. Set GMAIL_USER.");
  }
  return address;
}

export async function sendMail({ to, subject, text, html }: MailInput): Promise<void> {
  const recipients = (Array.isArray(to) ? to : [to])
    .map((address) => cleanHeader(address))
    .filter(Boolean);
  if (!recipients.length) throw new Error("Email requires at least one recipient.");
  if (!text && !html) throw new Error("Email requires text or HTML content.");

  const name = cleanHeader(await schoolName()).replace(/["\\]/g, "");
  const from = `"${name}" <${cleanHeader(senderAddress())}>`;
  const safeSubject = cleanHeader(subject);
  const smtp = getTransport();
  await reserveDailyRecipients(recipients.length);

  const options: SendMailOptions = {
    from,
    to: recipients,
    subject: safeSubject,
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
  };
  await smtp.sendMail(options);
}

export async function sendAdminOtpEmail(input: {
  to: string;
  code: string;
  schoolName?: string;
}): Promise<void> {
  const name = input.schoolName?.trim() || await schoolName();
  const safeName = escapeHtml(name);
  const safeCode = escapeHtml(input.code);
  const message: MailInput = {
    to: input.to,
    subject: `${cleanHeader(name)}: administrator verification code`,
    text: `${name}\n\nYour administrator verification code is ${input.code}.\nThis code is valid for 10 minutes. Never share this code. If this wasn't you, reset your password.`,
    html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>${safeName}</h2><p>Your administrator verification code is:</p><p style="font-size:36px;font-weight:700;letter-spacing:10px">${safeCode}</p><p>This code is valid for 10 minutes.</p><p><strong>Never share this code.</strong></p><p>If this wasn't you, reset your password.</p></main>`,
  };

  try {
    await sendMail(message);
  } catch (error) {
    const missingConfig =
      error instanceof Error &&
      /GMAIL_USER|GMAIL_APP_PASSWORD/.test(error.message);
    if (process.env.NODE_ENV !== "production" && missingConfig) {
      console.warn("[mailer] DEVELOPMENT FALLBACK — Gmail is not configured. Admin OTP:", input.code);
      return;
    }
    throw error;
  }
}
