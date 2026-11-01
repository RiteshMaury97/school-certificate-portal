"use client";
import { useEffect, useState } from "react";
export type PublicSiteSettings = {
  emergencyLockdown?: boolean;
  schoolName?: string;
  retentionYears?: number;
  backupRotationDays?: number;
  tagline?: string;
  logoUrl?: string;
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

const stringSettingKeys = [
  "schoolName",
  "tagline",
  "logoUrl",
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
const numberSettingKeys = ["retentionYears", "backupRotationDays"];

function hasExpectedStrings(settings: Record<string, unknown>): boolean {
  return stringSettingKeys.every(
    (key) => settings[key] === undefined || typeof settings[key] === "string",
  );
}

function hasExpectedNumbers(settings: Record<string, unknown>): boolean {
  return numberSettingKeys.every(
    (key) => settings[key] === undefined || typeof settings[key] === "number",
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
    (settings.emergencyLockdown === undefined ||
      typeof settings.emergencyLockdown === "boolean") &&
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

export function usePublicSiteSettings() {
  const [settings, setSettings] = useState<PublicSiteSettings>({});
  useEffect(() => {
    let active = true;
    fetch("/api/public/site-settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: unknown) => {
        if (active && isRecord(data) && isPublicSiteSettings(data.settings))
          setSettings(data.settings);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);
  return settings;
}
