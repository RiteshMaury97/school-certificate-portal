"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

export type AdminRole = "uploader" | "approver" | "admin" | "superadmin";
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

let sessionRequest: Promise<AdminSessionState> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readSessionBody(value: unknown): SessionBody {
  if (!isRecord(value)) return {};
  const body = value;
  const role = body.role;
  return {
    ...(typeof body.authenticated === "boolean" ? { authenticated: body.authenticated } : {}),
    ...(typeof body.uid === "string" ? { uid: body.uid } : {}),
    ...(typeof body.email === "string" ? { email: body.email } : {}),
    ...(role === "uploader" || role === "approver" || role === "admin" || role === "superadmin"
      ? { role }
      : {}),
    ...(typeof body.hardExpiresAt === "number" ? { hardExpiresAt: body.hardExpiresAt } : {}),
    ...(typeof body.error === "string" ? { error: body.error } : {}),
  };
}

function stateFromSessionResponse(
  status: number,
  ok: boolean,
  body: SessionBody,
): AdminSessionState {
  if (status === 401 || (ok && body.authenticated === false)) return { status: "unauthenticated" };
  if (!ok || !body.authenticated || !body.uid || !body.email || !body.role)
    return {
      status: "error",
      message: body.error ?? "The administrator session could not be verified.",
    };
  return {
    status: "authenticated",
    admin: { uid: body.uid, email: body.email, role: body.role },
    hardExpiresAt: body.hardExpiresAt ?? 0,
  };
}

function fetchSession(): Promise<AdminSessionState> {
  sessionRequest ??= readSession().finally(() => {
    sessionRequest = null;
  });
  return sessionRequest;
}

async function readSession(): Promise<AdminSessionState> {
  try {
    const response = await fetch("/api/admin/session", {
      cache: "no-store",
      credentials: "same-origin",
      headers: await appCheckHeaders(),
    });
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    const body = readSessionBody(json);
    return stateFromSessionResponse(response.status, response.ok, body);
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
    void fetchSession().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);
  const value = useMemo(() => ({ state, retry }), [state, retry]);
  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): Value {
  const value = useContext(AdminSessionContext);
  if (!value) throw new Error("useAdminSession must be used within AdminSessionProvider");
  return value;
}
