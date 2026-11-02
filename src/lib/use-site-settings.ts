"use client";
import { useEffect, useState } from "react";

export type PublicSiteSettings = {
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
  email?: string;
  jurisdiction?: string;
  socialLinks?: { label: string; url: string }[];
  includedLanguages?: string;
  announcement?: { type: "info" | "warning"; textEn: string; linkUrl: string } | null;
  grievanceOfficerName?: string;
  grievanceOfficerEmail?: string;
  grievanceOfficerPhone?: string;
  lastUpdated?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const stringKeys = [
  "schoolName",
  "tagline",
  "boardName",
  "affiliationNumber",
  "schoolCode",
  "principalPhotoUrl",
  "principalName",
  "principalMessage",
  "address",
  "phone",
  "officeHours",
  "mapUrl",
  "statusPageUrl",
  "email",
  "jurisdiction",
  "includedLanguages",
  "grievanceOfficerName",
  "grievanceOfficerEmail",
  "grievanceOfficerPhone",
  "lastUpdated",
];

function hasExpectedStrings(settings: Record<string, unknown>): boolean {
  return stringKeys.every((key) => settings[key] === undefined || typeof settings[key] === "string");
}

function hasExpectedNumbers(settings: Record<string, unknown>): boolean {
  return (
    (settings.retentionYears === undefined || typeof settings.retentionYears === "number") &&
    (settings.backupRotationDays === undefined || typeof settings.backupRotationDays === "number")
  );
}

function isSocialLinks(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (link: unknown) =>
        isRecord(link) && typeof link.label === "string" && typeof link.url === "string",
    )
  );
}

function isAnnouncement(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.type === "info" || value.type === "warning") &&
    typeof value.textEn === "string" &&
    typeof value.linkUrl === "string"
  );
}

function hasValidOptionalSettings(settings: Record<string, unknown>): boolean {
  return (
    (settings.socialLinks === undefined || isSocialLinks(settings.socialLinks)) &&
    (settings.announcement === undefined ||
      settings.announcement === null ||
      isAnnouncement(settings.announcement))
  );
}

function isPublicSiteSettings(value: unknown): value is PublicSiteSettings {
  return (
    isRecord(value) &&
    hasExpectedStrings(value) &&
    hasExpectedNumbers(value) &&
    hasValidOptionalSettings(value)
  );
}

function getSettings(data: unknown): PublicSiteSettings | null {
  if (!isRecord(data) || !isPublicSiteSettings(data.settings)) return null;
  return data.settings;
}

export function usePublicSiteSettings() {
  const [settings, setSettings] = useState<PublicSiteSettings>({});
  useEffect(() => {
    let active = true;
    fetch("/api/public/site-settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: unknown) => {
        const nextSettings = getSettings(data);
        if (active && nextSettings) setSettings(nextSettings);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);
  return settings;
}
