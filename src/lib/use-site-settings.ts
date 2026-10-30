"use client";
import { useEffect, useState } from "react";
export type PublicSiteSettings = {
  schoolName?: string;
  retentionYears?: number;
  retentionScheduleConfirmed?: boolean;
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
  email?: string;
  jurisdiction?: string;
  socialLinks?: { label: string; url: string }[];
  grievanceOfficerName?: string;
  grievanceOfficerEmail?: string;
  grievanceOfficerPhone?: string;
  lastUpdated?: string;
};
export function usePublicSiteSettings() {
  const [settings, setSettings] = useState<PublicSiteSettings>({});
  useEffect(() => {
    let active = true;
    fetch("/api/public/site-settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (active && data && typeof data.settings === "object")
          setSettings(data.settings as PublicSiteSettings);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return settings;
}
