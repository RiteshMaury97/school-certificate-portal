"use client";
import { useEffect, useState } from "react";

import { SCHOOL_INFO } from "@/lib/school-info";

export type PublicSiteSettings = {
  tagline_i18n?: Record<string, string> | undefined;
  principalMessage_i18n?: Record<string, string> | undefined;
  schoolName?: string;
  retentionYears?: number;
  backupRotationDays?: number;
  tagline?: string;
  boardName?: string;
  affiliationNumber?: string;
  schoolCode?: string;
  principalPhotoUrl?: string;
  principalName?: string;
  principalMessage?: string;
  address?: string;
  phone?: string;
  officeHours?: string;
  mapUrl?: string;
  statusPageUrl?: string;
  website?: string;
  email?: string;
  securityContactEmail?: string;
  jurisdiction?: string;
  socialLinks?: { label: string; url: string }[];
  includedLanguages?: string;
  announcement?: { type: "info" | "warning"; textEn: string; text_i18n?: Record<string, string> | undefined; linkUrl: string } | null | undefined;
  grievanceOfficerName?: string;
  grievanceOfficerEmail?: string;
  grievanceOfficerPhone?: string;
  lastUpdated?: string;
  faqs?: { questionEn: string; answerEn: string; question_i18n?: Record<string, string> | undefined; answer_i18n?: Record<string, string> | undefined }[] | undefined;
};

const DEFAULT_SETTINGS: PublicSiteSettings = {
  schoolName: SCHOOL_INFO.name,
  address: SCHOOL_INFO.address,
  phone: SCHOOL_INFO.phone,
  email: "",
  includedLanguages: "en,hi,bn,mr,gu,pa,ta,te,ur",
  announcement: null,
  socialLinks: [],
  faqs: [],
};
const stringKeys = [
  "schoolName", "tagline", "boardName", "affiliationNumber", "schoolCode", "principalPhotoUrl",
  "principalName", "principalMessage", "address", "phone", "officeHours", "mapUrl",
  "statusPageUrl", "website", "email", "securityContactEmail", "jurisdiction", "includedLanguages", "grievanceOfficerName",
  "grievanceOfficerEmail", "grievanceOfficerPhone", "lastUpdated",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function warnInvalid(field: string) {
  if (process.env.NODE_ENV === "development")
    console.warn(`[site-settings] Ignoring invalid ${field}; using its default value.`);
}

function parseStringSettings(source: Record<string, unknown>, result: PublicSiteSettings) {
  for (const key of stringKeys) {
    if (source[key] === undefined) continue;
    if (typeof source[key] === "string") result[key] = source[key];
    else warnInvalid(key);
  }
}

function parseNumberSettings(source: Record<string, unknown>, result: PublicSiteSettings) {
  for (const key of ["retentionYears", "backupRotationDays"] as const) {
    if (source[key] === undefined) continue;
    if (typeof source[key] === "number" && Number.isFinite(source[key])) result[key] = source[key];
    else warnInvalid(key);
  }
}

function parseSocialLinks(value: unknown): { label: string; url: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const links: { label: string; url: string }[] = [];
  for (const item of value) {
    if (isRecord(item) && typeof item.label === "string" && typeof item.url === "string")
      links.push({ label: item.label, url: item.url });
    else warnInvalid("socialLinks entry");
  }
  return links;
}

function parseLocalizedStrings(value: unknown, field: string): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const result: Record<string, string> = {};
  for (const locale of ["hi", "bn", "mr", "gu", "pa", "ta", "te", "ur"]) {
    const text = value[locale];
    if (text === undefined) continue;
    if (typeof text === "string") result[locale] = text;
    else warnInvalid(`${field}.${locale}`);
  }
  return result;
}

function parseFaqs(value: unknown): { questionEn: string; answerEn: string }[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const faqs: NonNullable<PublicSiteSettings["faqs"]> = [];
  for (const item of value) {
    if (isRecord(item) && typeof item.questionEn === "string" && typeof item.answerEn === "string") {
      faqs.push({
        questionEn: item.questionEn,
        answerEn: item.answerEn,
        question_i18n: parseLocalizedStrings(item.question_i18n, "faqs.question_i18n"),
        answer_i18n: parseLocalizedStrings(item.answer_i18n, "faqs.answer_i18n"),
      });
    }
    else warnInvalid("faqs entry");
  }
  return faqs;
}

function isAnnouncement(value: unknown): value is NonNullable<PublicSiteSettings["announcement"]> {
  return isRecord(value) && (value.type === "info" || value.type === "warning") &&
    typeof value.textEn === "string" && typeof value.linkUrl === "string";
}

function parseSettings(payload: unknown): PublicSiteSettings {
  const source = isRecord(payload) && isRecord(payload.settings) ? payload.settings : {};
  const result: PublicSiteSettings = { ...DEFAULT_SETTINGS };
  parseStringSettings(source, result);
  result.tagline_i18n = parseLocalizedStrings(source.tagline_i18n, "tagline_i18n");
  result.principalMessage_i18n = parseLocalizedStrings(source.principalMessage_i18n, "principalMessage_i18n");
  parseNumberSettings(source, result);
  if (source.socialLinks !== undefined) {
    const links = parseSocialLinks(source.socialLinks);
    if (links) result.socialLinks = links;
    else warnInvalid("socialLinks");
  }
  if (source.faqs !== undefined) {
    const faqs = parseFaqs(source.faqs);
    if (faqs) result.faqs = faqs;
    else warnInvalid("faqs");
  }
  if (source.announcement !== undefined) {
    const item = source.announcement;
    if (item === null) result.announcement = null;
    else if (isAnnouncement(item))
      result.announcement = { ...item, text_i18n: parseLocalizedStrings(item.text_i18n, "announcement.text_i18n") };
    else warnInvalid("announcement");
  }
  return result;
}

let cachedSettings: PublicSiteSettings = DEFAULT_SETTINGS;
let cacheExpiresAt = 0;
let settingsRequest: Promise<PublicSiteSettings> | null = null;

function fetchPublicSettings(): Promise<PublicSiteSettings> {
  if (cacheExpiresAt > Date.now()) return Promise.resolve(cachedSettings);
  settingsRequest ??= fetch("/api/public/site-settings", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Site settings returned ${String(response.status)}`);
      cachedSettings = parseSettings(await response.json());
      cacheExpiresAt = Date.now() + 60_000;
      return cachedSettings;
    })
    .catch((error: unknown) => {
      if (process.env.NODE_ENV === "development")
        console.warn("[site-settings] Could not load public settings; using defaults.", error);
      cacheExpiresAt = Date.now() + 10_000;
      return cachedSettings;
    })
    .finally(() => { settingsRequest = null; });
  return settingsRequest;
}

export function usePublicSiteSettings(): PublicSiteSettings {
  const [settings, setSettings] = useState<PublicSiteSettings>(cachedSettings);
  useEffect(() => {
    let active = true;
    void fetchPublicSettings().then((next) => { if (active) setSettings(next); });
    return () => { active = false; };
  }, []);
  return settings;
}
