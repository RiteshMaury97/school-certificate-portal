import { z } from "zod";

import { absoluteUrl } from "@/server/site-origin";
import { getCachedSiteSettings } from "@/server/site-settings-cache";

export const dynamic = "force-dynamic";

function validEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim() : "";
  return z.email().safeParse(email).success ? email : "";
}

export async function GET(): Promise<Response> {
  let settingsContact = "";
  try {
    const settings = await getCachedSiteSettings();
    settingsContact = validEmail(settings.securityContactEmail) || validEmail(settings.email);
  } catch (error) {
    console.error("[security.txt] Could not read the configured security contact.", error);
  }
  const contact = settingsContact || validEmail(process.env.SECURITY_CONTACT_EMAIL);
  if (!contact) return new Response("Security contact is not configured.\n", { status: 503 });

  const expires = new Date();
  expires.setUTCFullYear(expires.getUTCFullYear() + 1);
  const body = [
    `Contact: mailto:${contact}`,
    `Expires: ${expires.toISOString()}`,
    `Canonical: ${absoluteUrl("/.well-known/security.txt")}`,
    `Policy: ${absoluteUrl("/privacy")}`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
