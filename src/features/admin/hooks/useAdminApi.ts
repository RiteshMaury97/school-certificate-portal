import { useCallback, useState } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

import { csrf } from "../utils/admin-helpers";

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
  const api = useCallback(
    async <T extends Record<string, unknown> = Record<string, unknown>>(
      url: string,
      init: RequestInit = {},
    ): Promise<T> => {
      const method = (init.method ?? "GET").toUpperCase();
      const headers = new Headers(init.headers);
      for (const [key, value] of Object.entries(await appCheckHeaders())) headers.set(key, value);
      if (!["GET", "HEAD", "OPTIONS"].includes(method))
        headers.set("x-csrf-token", decodeURIComponent(csrf()));
      const options: RequestInit = {
        ...init,
        headers,
        credentials: "same-origin",
        cache: "no-store",
      };
      let response = await fetch(url, options);
      if (response.status === 428) {
        const grant = await obtainReauthGrant();
        headers.set("x-admin-reauth", grant);
        response = await fetch(url, { ...options, headers });
      }
      const data: unknown = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          typeof data === "object" && data !== null && "error" in data
            ? String(data.error)
            : "Request failed",
        );
      return data as T;
    },
    [obtainReauthGrant],
  );
  return { api, reauthOpen, completeReauth, cancelReauth };
}
