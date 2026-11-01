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

const normalizeSocialLinks = (value?: string) =>
  (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split("|");
      return { label: (label ?? "").trim(), url: rest.join("|").trim() };
    });

const normalizeCsvList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

const normalizeLineList = (value: string) =>
  value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

export function useSiteSettingsAdmin(
  api: Api,
  act: (fn: () => Promise<void>) => Promise<void>,
  setToast: Dispatch<SetStateAction<string>>,
) {
  const [retentionYears, setRetentionYears] = useState("7");
  const [backupRotationDays, setBackupRotationDays] = useState("30");
  const [faqs, setFaqs] = useState<FaqItem[]>(createDefaultFaqs());
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [emergencyLockdown, setEmergencyLockdown] = useState(false);
  const [allowedAdminCountries, setAllowedAdminCountries] = useState("IN");
  const [adminIpAllowlist, setAdminIpAllowlist] = useState("");
  const [adminEnforcementMode, setAdminEnforcementMode] = useState("block");
  const [locationExceptions, setLocationExceptions] = useState<Record<string, unknown>[]>([]);
  const [recentLocationBlocks, setRecentLocationBlocks] = useState<Record<string, unknown>[]>([]);
  const [announcement, setAnnouncement] = useState<AnnouncementState>(createDefaultAnnouncement());
  const [branding, setBranding] = useState<Record<string, string>>(createDefaultBranding());

  async function saveFaqs() {
    await act(async () => {
      await api("/api/admin/faqs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faqs }),
      });
    });
  }

  async function saveBranding(e: SubmitEvent) {
    e.preventDefault();
    await act(async () => {
      await api("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...branding,
          socialLinks: normalizeSocialLinks(branding.socialLinks),
          maintenanceMode,
          emergencyLockdown,
          retentionYears: Number(retentionYears),
          backupRotationDays: Number(backupRotationDays),
          allowedAdminCountries: normalizeCsvList(allowedAdminCountries),
          adminIpAllowlist: normalizeLineList(adminIpAllowlist),
          adminEnforcementMode,
        }),
      });
    });
  }

  async function addLocationException(input: {
    type: "country" | "admin";
    country?: string;
    adminUid?: string;
    expiresAt: string;
    reason: string;
  }) {
    await act(async () => {
      await api("/api/admin/location-policy/exceptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      setToast("Temporary location exception added.");
    });
  }

  async function removeLocationException(id: string) {
    await act(async () => {
      await api(`/api/admin/location-policy/exceptions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setLocationExceptions((current) => current.filter((exception) => exception.id !== id));
      setToast("Temporary location exception removed.");
    });
  }

  async function saveAnnouncement(e: SubmitEvent) {
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
    emergencyLockdown,
    setEmergencyLockdown,
    allowedAdminCountries,
    setAllowedAdminCountries,
    adminIpAllowlist,
    setAdminIpAllowlist,
    adminEnforcementMode,
    setAdminEnforcementMode,
    locationExceptions,
    setLocationExceptions,
    recentLocationBlocks,
    setRecentLocationBlocks,
    addLocationException,
    removeLocationException,
    announcement,
    setAnnouncement,
    branding,
    setBranding,
    saveFaqs,
    saveBranding,
    saveAnnouncement,
  };
}
