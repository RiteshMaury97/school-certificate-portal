import { useCallback, useEffect, useState } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";
import { ADMIN_IDLE_TIMEOUT_MS, ADMIN_IDLE_WARNING_MS } from "@/shared/session-policy";

import { csrf } from "../utils/admin-helpers";

import type { Role } from "../types/admin.types";
import type { AdminSessionState } from "@/features/auth/admin-session";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
type Props = { sessionState: AdminSessionState; api: Api; onLogin: () => void };
function ignoreRequestFailure(error: unknown): void {
  if (error instanceof Error) console.warn("Session refresh failed", error.message);
}
function readHardExpiry(value: unknown): number | null {
  if (typeof value !== "object" || value === null || !("hardExpiresAt" in value)) return null;
  return typeof value.hardExpiresAt === "number" ? value.hardExpiresAt : null;
}
function useSessionExpiryTimers(
  email: string,
  logout: () => Promise<void>,
  setIdleWarning: (value: boolean) => void,
): void {
  useEffect(() => {
    if (!email) return;
    let lastActivity = Date.now();
    let lastScheduled = 0;
    let warningTimer: ReturnType<typeof setTimeout> | null = null;
    let logoutTimer: ReturnType<typeof setTimeout> | null = null;
    let hardExpiryTimer: ReturnType<typeof setTimeout> | null = null;
    const clear = () => {
      if (warningTimer !== null) clearTimeout(warningTimer);
      if (logoutTimer !== null) clearTimeout(logoutTimer);
    };
    const schedule = () => {
      clear();
      setIdleWarning(false);
      lastActivity = Date.now();
      lastScheduled = lastActivity;
      warningTimer = setTimeout(() => {
        setIdleWarning(true);
      }, ADMIN_IDLE_WARNING_MS);
      logoutTimer = setTimeout(() => void logout(), ADMIN_IDLE_TIMEOUT_MS);
    };
    const activity = () => {
      lastActivity = Date.now();
      if (Date.now() - lastScheduled > 5_000) schedule();
    };
    const externalActivity = () => {
      schedule();
    };
    const events = ["pointerdown", "keydown", "mousemove", "scroll", "touchstart"];
    for (const event of events) window.addEventListener(event, activity, { passive: true });
    window.addEventListener("sis-session-activity", externalActivity);
    schedule();
    const refreshSession = async () => {
      const response = await fetch("/api/admin/session", {
        headers: await appCheckHeaders(),
        cache: "no-store",
      });
      if (!response.ok) {
        await logout();
        return;
      }
      const hardExpiry = readHardExpiry(await response.json());
      if (hardExpiry !== null) {
        if (hardExpiryTimer !== null) clearTimeout(hardExpiryTimer);
        hardExpiryTimer = setTimeout(() => void logout(), Math.max(0, hardExpiry - Date.now()));
      }
    };
    const pingTimer = setInterval(() => {
      if (Date.now() - lastActivity < 20_000) void refreshSession().catch(ignoreRequestFailure);
    }, 15_000);
    void refreshSession().catch(ignoreRequestFailure);
    return () => {
      clear();
      if (hardExpiryTimer !== null) clearTimeout(hardExpiryTimer);
      clearInterval(pingTimer);
      for (const event of events) window.removeEventListener(event, activity);
      window.removeEventListener("sis-session-activity", externalActivity);
    };
  }, [email, logout, setIdleWarning]);
}
export function useAdminSessionLifecycle({ sessionState, api, onLogin }: Props) {
  const uid = sessionState.status === "authenticated" ? sessionState.admin.uid : "";
  const email = sessionState.status === "authenticated" ? sessionState.admin.email : "";
  const role: Role = sessionState.status === "authenticated" ? sessionState.admin.role : "uploader";
  const [idleWarning, setIdleWarning] = useState(false);
  const [sessions, setSessions] = useState<Record<string, unknown>[]>([]);
  const [recentLogins, setRecentLogins] = useState<Record<string, unknown>[]>([]);
  const [sessionsError, setSessionsError] = useState("");
  const logout = useCallback(async () => {
    try {
      await fetch("/api/admin/session", {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "x-csrf-token": decodeURIComponent(csrf()),
          ...(await appCheckHeaders()),
        },
      });
    } catch {
      /* Clear the local route even when the network is unavailable. */
    }
    onLogin();
  }, [onLogin]);
  useSessionExpiryTimers(email, logout, setIdleWarning);
  async function staySignedIn() {
    try {
      const headers = await appCheckHeaders();
      const response = await fetch("/api/admin/session", {
        headers,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Session refresh failed");
      setIdleWarning(false);
      window.dispatchEvent(new Event("sis-session-activity"));
    } catch {
      await logout();
    }
  }
  const loadSessions = useCallback(async () => {
    setSessionsError("");
    try {
      const d = await api<{
        sessions: Record<string, unknown>[];
        recentLogins: Record<string, unknown>[];
      }>("/api/admin/sessions");
      setSessions(d.sessions);
      setRecentLogins(d.recentLogins);
    } catch (error) {
      setSessionsError(error instanceof Error ? error.message : "Could not load account sessions.");
    }
  }, [api]);
  async function revokeSession(sessionId: string) {
    const current = sessions.some((item) => item.sessionId === sessionId && item.current === true);
    try {
      setSessionsError("");
      await api("/api/admin/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (current) {
        onLogin();
        return;
      }
      await loadSessions();
    } catch (error) {
      setSessionsError(error instanceof Error ? error.message : "Could not revoke this session.");
    }
  }
  async function revokeAllSessions() {
    try {
      await api("/api/admin/sessions/revoke-all", { method: "POST" });
      onLogin();
    } catch (error) {
      setSessionsError(error instanceof Error ? error.message : "Could not revoke all sessions.");
    }
  }
  return {
    uid,
    role,
    email,
    idleWarning,
    setIdleWarning,
    sessions,
    recentLogins,
    sessionsError,
    loadSessions,
    revokeSession,
    revokeAllSessions,
    logout,
    staySignedIn,
  };
}
