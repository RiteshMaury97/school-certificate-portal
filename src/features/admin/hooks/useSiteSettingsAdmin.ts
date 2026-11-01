import { useState, type SubmitEvent, type Dispatch, type SetStateAction } from "react";

import {
  createDefaultAnnouncement,
  createDefaultBranding,
  createDefaultFaqs,
} from "../config/admin-defaults";

import type { AnnouncementState, FaqItem } from "../types/admin-state.types";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
export function useSiteSettingsAdmin(
  api: Api,
  act: (fn: () => Promise<void>) => Promise<void>,
  setToast: Dispatch<SetStateAction<string>>,
) {
  const [retentionYears, setRetentionYears] = useState("7");
  const [backupRotationDays, setBackupRotationDays] = useState("30");
  const [faqs, setFaqs] = useState<FaqItem[]>(createDefaultFaqs());
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [announcement, setAnnouncement] = useState<AnnouncementState>(createDefaultAnnouncement());
  const [branding, setBranding] = useState<Record<string, string>>(createDefaultBranding());
  const [allowedAdminCountries, setAllowedAdminCountries] = useState("IN");
  const [adminIpAllowlist, setAdminIpAllowlist] = useState("");
  const [adminLocationEnforcementMode, setAdminLocationEnforcementMode] = useState("block");
  const [recentLocationBlocks, setRecentLocationBlocks] = useState<Record<string, unknown>[]>([]);
  const [adminLocationExceptions, setAdminLocationExceptions] = useState<Record<string, unknown>[]>(
    [],
  );
  async function saveFaqs() {
    await act(async () => {
      await api("/api/admin/faqs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faqs }),
      });
    });
  }
  async function saveBranding(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    await act(async () => {
      const socialLinks = (branding.socialLinks ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [label, ...rest] = line.split("|");
          return { label: (label ?? "").trim(), url: rest.join("|").trim() };
        });
      await api("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...branding,
          socialLinks,
          maintenanceMode,
          retentionYears: Number(retentionYears),
          backupRotationDays: Number(backupRotationDays),
          allowedAdminCountries: allowedAdminCountries
            .split(/[\n,]/)
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean),
          adminIpAllowlist: adminIpAllowlist
            .split(/[\n,]/)
            .map((value) => value.trim())
            .filter(Boolean),
          adminLocationEnforcementMode,
        }),
      });
    });
  }

  async function addAdminLocationException(input: {
    country?: string;
    adminUid?: string;
    expiresInHours: number;
    reason: string;
  }) {
    const result = await api<{ exception: Record<string, unknown> }>(
      "/api/admin/location-exceptions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    setAdminLocationExceptions((current) => [result.exception, ...current]);
    setToast("Temporary location exception added.");
  }

  async function saveAnnouncement(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    await act(async () => {
      await api("/api/admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...announcement,
          startAt: new Date(announcement.startAt).toISOString(),
          endAt: new Date(announcement.endAt).toISOString(),
        }),
      });
      setToast("Announcement saved.");
    });
  }
  return {
    retentionYears,
    setRetentionYears,
    backupRotationDays,
    setBackupRotationDays,
    faqs,
    setFaqs,
    maintenanceMode,
    setMaintenanceMode,
    announcement,
    setAnnouncement,
    branding,
    setBranding,
    allowedAdminCountries,
    setAllowedAdminCountries,
    adminIpAllowlist,
    setAdminIpAllowlist,
    adminLocationEnforcementMode,
    setAdminLocationEnforcementMode,
    recentLocationBlocks,
    setRecentLocationBlocks,
    adminLocationExceptions,
    setAdminLocationExceptions,
    saveFaqs,
    saveBranding,
    addAdminLocationException,
    saveAnnouncement,
  };
}
