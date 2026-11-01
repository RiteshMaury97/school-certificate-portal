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
export function useAdminSessionLifecycle({ sessionState, api, onLogin }: Props) {
  const [uid, setUid] = useState("");
  const [role, setRole] = useState<Role>("uploader");
  const [email, setEmail] = useState("");
  const [idleWarning, setIdleWarning] = useState(false);
  const [sessions, setSessions] = useState<Record<string, unknown>[]>([]);
  const [recentLogins, setRecentLogins] = useState<Record<string, unknown>[]>([]);
  const [showSessions, setShowSessions] = useState(false);
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
  useEffect(() => {
    // Identity comes from the shared, server-verified session (see AdminGate).
    if (sessionState.status !== "authenticated") return;
    setUid(sessionState.admin.uid);
    setEmail(sessionState.admin.email);
    setRole(sessionState.admin.role);
  }, [sessionState]);
  useEffect(() => {
    if (!email) return;
    let lastActivity = Date.now(),
      lastScheduled = 0,
      warningTimer: ReturnType<typeof setTimeout> | undefined,
      logoutTimer: ReturnType<typeof setTimeout> | undefined,
      pingTimer: ReturnType<typeof setInterval> | undefined,
      hardExpiryTimer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      if (warningTimer) clearTimeout(warningTimer);
      if (logoutTimer) clearTimeout(logoutTimer);
    };
    const schedule = () => {
      clear();
      setIdleWarning(false);
      lastActivity = Date.now();
      lastScheduled = lastActivity;
      warningTimer = setTimeout(() => {
        setIdleWarning(true);
      }, ADMIN_IDLE_WARNING_MS);
      logoutTimer = setTimeout(() => {
        void logout();
      }, ADMIN_IDLE_TIMEOUT_MS);
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
      const headers = await appCheckHeaders();
      const response = await fetch("/api/admin/session", {
        headers,
        cache: "no-store",
      });
      if (!response.ok) {
        await logout();
        return;
      }
      const data = (await response.json()) as { hardExpiresAt?: number };
      if (typeof data.hardExpiresAt === "number") {
        if (hardExpiryTimer) clearTimeout(hardExpiryTimer);
        hardExpiryTimer = setTimeout(
          () => {
            void logout();
          },
          Math.max(0, data.hardExpiresAt - Date.now()),
        );
      }
    };
    void refreshSession().catch(() => {});
    pingTimer = setInterval(() => {
      if (Date.now() - lastActivity < 20_000) {
        void refreshSession().catch(() => {});
      }
    }, 15_000);
    return () => {
      clear();
      if (hardExpiryTimer) clearTimeout(hardExpiryTimer);
      if (pingTimer) clearInterval(pingTimer);
      for (const event of events) window.removeEventListener(event, activity);
      window.removeEventListener("sis-session-activity", externalActivity);
    };
  }, [email, logout]);
  async function staySignedIn() {
    try {
      const headers = await appCheckHeaders();
      const response = await fetch("/api/admin/session", {
        headers,
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setIdleWarning(false);
      window.dispatchEvent(new Event("sis-session-activity"));
    } catch {
      await logout();
    }
  }
  async function loadSessions() {
    setSessionsError("");
    try {
      const d = await api<{
        sessions: Record<string, unknown>[];
        recentLogins: Record<string, unknown>[];
      }>("/api/admin/sessions");
      setSessions(d.sessions ?? []);
      setRecentLogins(d.recentLogins ?? []);
    } catch (error) {
      setSessionsError(error instanceof Error ? error.message : "Could not load account sessions.");
    } finally {
      setShowSessions(true);
    }
  }
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
    if (!confirm("Sign out of every device? You will need to sign in again.")) return;
    try {
      await api("/api/admin/sessions/revoke-all", { method: "POST" });
      onLogin();
    } catch (error) {
      setSessionsError(error instanceof Error ? error.message : "Could not revoke all sessions.");
      setShowSessions(true);
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
    showSessions,
    setShowSessions,
    sessionsError,
    loadSessions,
    revokeSession,
    revokeAllSessions,
    logout,
    staySignedIn,
  };
}
