"use client";

import { useCallback, useEffect, useState } from "react";

import ErrorState from "@/components/feedback/ErrorState";

type AdminStatusBannersProps = {
  toast: string;
  error: string;
  busy: boolean;
  onRetry: () => void;
};

export default function AdminStatusBanners({
  toast,
  error,
  busy,
  onRetry,
}: AdminStatusBannersProps) {
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
  return (
    <>
      {emergencyLockdown && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm font-semibold text-amber-950"
        >
          Emergency lockdown is active. Public lookup, verification and downloads are returning a
          maintenance response; admin sign-in remains available.
        </p>
      )}
      {toast && (
        <p
          role="status"
          className="mb-4 rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--text)]"
        >
          {toast}
        </p>
      )}
      {error && (
        <div className="mb-4">
          <ErrorState
            title="Admin request could not be completed"
            description={error}
            onRetry={onRetry}
          />
        </div>
      )}
      {busy && (
        <p role="status" aria-live="polite" className="mb-5 text-sm text-[var(--text-muted)]">
          Loading admin data…
        </p>
      )}
    </>
  );
}
