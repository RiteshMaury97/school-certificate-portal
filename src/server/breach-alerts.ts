import "server-only";

import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { absoluteUrl } from "@/server/site-origin";

function breachAdminUrl(): string {
  return absoluteUrl("/admin/breaches");
}

export async function sendImmediateBreachAlert(input: {
  title: string;
  severity: string;
}): Promise<void> {
  const admins = await db
    .collection("admins")
    .where("role", "==", "superadmin")
    .where("status", "==", "active")
    .get();
  const recipients = [
    ...new Set(admins.docs.map((doc) => String(doc.get("email") ?? "").trim()).filter(Boolean)),
  ];
  if (!recipients.length) throw new Error("No active superadmin email recipients are configured.");

  const url = breachAdminUrl();
  await sendMail({
    to: recipients,
    subject: `${process.env.GMAIL_FROM_NAME?.trim() ?? "School portal"}: breach incident reported`,
    text: `A breach incident was reported.\n\nTitle: ${input.title}\nSeverity: ${input.severity}\nReview: ${url}`,
  });
}
