"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { appCheckHeaders } from "@/lib/firebase-client";

export type AdminRole = "uploader" | "approver" | "superadmin";
export type AdminIdentity = { uid: string; email: string; role: AdminRole };

/**
 * "unauthenticated" means the server said the cookie is missing/expired/revoked.
 * "error" means we could not find out (network, App Check, server outage): the
 * administrator is NOT treated as signed out and can retry.
 */
export type AdminSessionState =
  | { status: "loading" }
  | { status: "authenticated"; admin: AdminIdentity; hardExpiresAt: number }
  | { status: "unauthenticated" }
  | { status: "error"; message: string };

type Value = { state: AdminSessionState; retry: () => void };
const AdminSessionContext = createContext<Value | null>(null);

type SessionBody = {
  authenticated?: boolean;
  uid?: string;
  email?: string;
  role?: AdminRole;
  hardExpiresAt?: number;
  error?: string;
};

async function fetchSession(): Promise<AdminSessionState> {
  try {
    const response = await fetch("/api/admin/session", {
      cache: "no-store",
      credentials: "same-origin",
      headers: await appCheckHeaders(),
    });
    const body = (await response.json().catch(() => ({}))) as SessionBody;
    if (response.status === 401) return { status: "unauthenticated" };
    if (!response.ok || !body.authenticated || !body.uid || !body.email || !body.role)
      return {
        status: "error",
        message: body.error ?? "The administrator session could not be verified.",
      };
    return {
      status: "authenticated",
      admin: { uid: body.uid, email: body.email, role: body.role },
      hardExpiresAt: body.hardExpiresAt ?? 0,
    };
  } catch {
    return { status: "error", message: "Check your connection and try again." };
  }
}

/** Validates the server-side session cookie once for the whole admin area. */
export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminSessionState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });
    void fetchSession().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const value = useMemo(() => ({ state, retry }), [state, retry]);
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): Value {
  const value = useContext(AdminSessionContext);
  if (!value) throw new Error("useAdminSession must be used within AdminSessionProvider");
  return value;
}
