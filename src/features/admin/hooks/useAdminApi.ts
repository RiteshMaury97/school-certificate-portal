import { useCallback, useMemo, useState } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

import { csrf } from "../utils/admin-helpers";

type ApiRecord = Record<string, unknown>;
type ApiParser<T extends ApiRecord> = (value: unknown) => T;
type ReauthGrant = () => Promise<string>;

function isApiRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseApiRecord(value: unknown): ApiRecord {
  if (!isApiRecord(value)) throw new Error("Request failed");
  return value;
}

async function createRequestOptions(init: RequestInit): Promise<RequestInit> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(await appCheckHeaders())) headers.set(key, value);
  if (!["GET", "HEAD", "OPTIONS"].includes(method))
    headers.set("x-csrf-token", decodeURIComponent(csrf()));
  return { ...init, headers, credentials: "same-origin", cache: "no-store" };
}

async function fetchWithReauth(
  url: string,
  options: RequestInit,
  obtainReauthGrant: ReauthGrant,
): Promise<Response> {
  const response = await fetch(url, options);
  if (response.status !== 428) return response;
  const headers = new Headers(options.headers);
  headers.set("x-admin-reauth", await obtainReauthGrant());
  return fetch(url, { ...options, headers });
}

async function parseResponse<T extends ApiRecord>(
  response: Response,
  parse?: ApiParser<T>,
): Promise<ApiRecord | T> {
  if (response.status === 401 && typeof window !== "undefined") {
    window.location.assign("/admin/login");
    throw new Error("Your administrator session expired. Sign in again.");
  }
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      isApiRecord(data) && "error" in data ? String(data.error) : "Request failed",
    );
  }
  return parse ? parse(data) : parseApiRecord(data);
}

function createAdminApi(obtainReauthGrant: ReauthGrant) {
  function api(url: string, init?: RequestInit): Promise<ApiRecord>;
  function api<T extends ApiRecord>(
    url: string,
    init: RequestInit,
    parse: ApiParser<T>,
  ): Promise<T>;
  async function api<T extends ApiRecord>(
    url: string,
    init: RequestInit = {},
    parse?: ApiParser<T>,
  ): Promise<ApiRecord | T> {
    const options = await createRequestOptions(init);
    const response = await fetchWithReauth(url, options, obtainReauthGrant);
    return parseResponse(response, parse);
  }
  return api;
}

export function useAdminApi() {
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthResolver, setReauthResolver] = useState<((grant: string) => void) | null>(null);
  const [reauthRejecter, setReauthRejecter] = useState<((reason: Error) => void) | null>(null);
  const obtainReauthGrant = useCallback((): Promise<string> => {
    setReauthOpen(true);
    return new Promise<string>((resolve, reject) => {
      setReauthResolver(() => resolve);
      setReauthRejecter(() => reject);
    });
  }, []);
  const completeReauth = useCallback(
    (grant: string) => {
      reauthResolver?.(grant);
      setReauthOpen(false);
      setReauthResolver(null);
      setReauthRejecter(null);
    },
    [reauthResolver],
  );
  const cancelReauth = useCallback(() => {
    reauthRejecter?.(new Error("Re-authentication cancelled."));
    setReauthOpen(false);
    setReauthResolver(null);
    setReauthRejecter(null);
  }, [reauthRejecter]);
  const api = useMemo(() => createAdminApi(obtainReauthGrant), [obtainReauthGrant]);
  return { api, reauthOpen, completeReauth, cancelReauth };
}
