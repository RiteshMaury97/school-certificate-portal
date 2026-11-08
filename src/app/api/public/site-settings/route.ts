import { NextResponse } from "next/server";
import { z } from "zod";

import { getSiteOrigin } from "@/server/site-origin";
import { getCachedSiteSettings } from "@/server/site-settings-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function validEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim() : "";
  return z.email().safeParse(email).success ? email : "";
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function publicWebsite(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function publicHttps(value: unknown): string {
  return publicWebsite(value, "");
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[<>\u0000-\u001f\u007f]/g, " ")
    .slice(0, maxLength);
}

function isSupportedLocaleCode(value: string): boolean {
  const [language, region] = value.split("-");
  return (
    /^[a-z]{2,3}$/i.test(language ?? "") &&
    (region === undefined || /^[a-z]{2}$/i.test(region))
  );
}

function activeAnnouncement(value: unknown, now: number) {
  if (!isRecord(value) || value.enabled !== true) return null;
  if (value.type !== "info" && value.type !== "warning") return null;
  const start = Date.parse(safeString(value.startAt));
  const end = Date.parse(safeString(value.endAt));
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > now || end <= now)
    return null;
  const textEn = cleanText(value.textEn, 240);
  if (!textEn) return null;
  return {
    type: value.type,
    textEn,
    text_i18n: localizedText(value.text_i18n, 240),
    linkUrl: publicWebsite(value.linkUrl, ""),
  };
}

const localizedText = (value: unknown, maxLength: number) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => /^[a-z]{2}$/.test(key) && typeof item === "string")
      .map(([key, item]) => [key, String(item).replace(/<[^>]*>/g, "").replace(/[<>\u0000-\u001f\u007f]/g, " ").slice(0, maxLength)]),
  );
};
// A bad origin setting must never turn this public endpoint into a 500.
function safeSiteOrigin(): string {
  try {
    return getSiteOrigin();
  } catch {
    return "";
  }
}
export async function GET() {
  const fallbackWebsite = safeSiteOrigin();
  try {
    const data = await getCachedSiteSettings();
    const safe = {
      maintenanceMode: data.maintenanceMode === true,
      retentionYears: Math.max(
        1,
        Math.min(30, Number(data.retentionYears ?? 7)),
      ),
      backupRotationDays: Math.max(
        7,
        Math.min(365, Number(data.backupRotationDays ?? 30)),
      ),
      schoolName: safeString(data.schoolName),
      includedLanguages:
        typeof data.includedLanguages === "string"
          ? data.includedLanguages
              .split(",")
              .map((code: string) => code.trim().toLowerCase())
              .filter(isSupportedLocaleCode)
              .slice(0, 30)
              .join(",")
          : "en,hi,bn,mr,gu,pa,ta,te,ur",
      tagline: safeString(data.tagline),
      tagline_i18n: localizedText(data.tagline_i18n, 240),
      statusPageUrl: publicHttps(data.statusPageUrl),
      boardName: safeString(data.boardName),
      affiliationNumber: safeString(data.affiliationNumber),
      schoolCode: safeString(data.schoolCode),
      principalPhotoUrl: safeString(data.principalPhotoUrl),
      principalName: safeString(data.principalName),
      principalMessage: safeString(data.principalMessage),
      principalMessage_i18n: localizedText(data.principalMessage_i18n, 1800),
      address: safeString(data.address),
      phone: safeString(data.phone),
      website: publicWebsite(data.website, fallbackWebsite),
      email: validEmail(data.email),
      securityContactEmail: validEmail(data.securityContactEmail),
      jurisdiction: safeString(data.jurisdiction),
      officeHours: safeString(data.officeHours),
      mapUrl: publicHttps(data.mapUrl),
      faqs: Array.isArray(data.faqs)
        ? data.faqs
            .filter(isRecord)
            .slice(0, 30)
            .map((item) => ({
              questionEn: safeString(item.questionEn).slice(0, 180),
              answerEn: safeString(item.answerEn).slice(0, 1500),
              question_i18n: localizedText(item.question_i18n, 180),
              answer_i18n: localizedText(item.answer_i18n, 1500),
            }))
        : [],
      socialLinks: Array.isArray(data.socialLinks)
        ? data.socialLinks
            .filter(isRecord)
            .filter((item) =>
              typeof item.label === "string" &&
              item.label.length <= 40 &&
              typeof item.url === "string" &&
              item.url.startsWith("https://"),
            )
            .map((item) => ({
              label: safeString(item.label),
              url: safeString(item.url),
            }))
        : [],
      grievanceOfficerName: safeString(data.grievanceOfficerName),
      grievanceOfficerEmail: validEmail(data.grievanceOfficerEmail),
      grievanceOfficerPhone: safeString(data.grievanceOfficerPhone),
      lastUpdated: safeString(data.lastUpdated),
      announcement: activeAnnouncement(data.announcement, Date.now()),
    };
    return NextResponse.json(
      { settings: safe },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[site-settings] Could not load public site settings.", error);
    return NextResponse.json(
      { error: "Unable to load public site settings." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
