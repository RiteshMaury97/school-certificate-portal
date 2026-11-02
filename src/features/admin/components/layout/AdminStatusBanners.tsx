"use client";

import { useCallback, useEffect, useState } from "react";

import { toast as uiToast } from "@/components/ui/toast";

export default function AdminStatusBanners() {
  const [emergencyLockdown, setEmergencyLockdown] = useState(false);
  const refreshLockdown = useCallback(async () => {
    try {
      const response = await fetch("/api/public/site-settings", { cache: "no-store" });
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "settings" in body) {
        const settings = body.settings;
        setEmergencyLockdown(
          typeof settings === "object" &&
            settings !== null &&
            "maintenanceMode" in settings &&
            settings.maintenanceMode === true,
        );
      }
    } catch {
      setEmergencyLockdown(false);
    }
  }, []);
  useEffect(() => {
    if (emergencyLockdown) uiToast.add({ type: "warning", title: "Emergency lockdown is active", description: "Public lookup, verification and downloads are in maintenance mode." });
  }, [emergencyLockdown]);
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshLockdown();
    }, 0);
    const handleSettingsUpdated = () => {
      void refreshLockdown();
    };
    window.addEventListener("site-settings-updated", handleSettingsUpdated);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("site-settings-updated", handleSettingsUpdated);
    };
  }, [refreshLockdown]);
  return null;
}
