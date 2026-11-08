"use client";

import { getApps, initializeApp } from "firebase/app";
import {
  CustomProvider,
  getToken,
  initializeAppCheck,
  type AppCheck,
} from "firebase/app-check";
import { getAuth } from "firebase/auth";

import { AppCheckTokenError, appCheckFailureCode } from "./app-check-errors";
import { applyCspNonce } from "./csp";

function requiredFirebaseConfig(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`Missing Firebase client configuration: ${name}`);
  return normalized;
}

const config = {
  apiKey: requiredFirebaseConfig(process.env.FIREBASE_API_KEY, "FIREBASE_API_KEY"),
  authDomain: requiredFirebaseConfig(process.env.FIREBASE_AUTH_DOMAIN, "FIREBASE_AUTH_DOMAIN"),
  projectId: requiredFirebaseConfig(process.env.FIREBASE_PROJECT_ID, "FIREBASE_PROJECT_ID"),
  appId: requiredFirebaseConfig(
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ),
};

const existingApps = getApps();
export const firebaseApp = existingApps[0] ?? initializeApp(config);
export const auth = getAuth(firebaseApp);

const isProduction = process.env.NODE_ENV === "production";
type AppCheckRuntime = {
  instance: AppCheck | null;
  initialization: Promise<AppCheck> | null;
  turnstileScript: Promise<void> | null;
  cachedToken: string;
  tokenExpiresAt: number;
  tokenRequest: Promise<string> | null;
};
type AppCheckGlobal = typeof globalThis & { __sisPortalAppCheckRuntime?: AppCheckRuntime };
const appCheckRuntime = ((globalThis as AppCheckGlobal).__sisPortalAppCheckRuntime ??= {
  instance: null,
  initialization: null,
  turnstileScript: null,
  cachedToken: "",
  tokenExpiresAt: 0,
  tokenRequest: null,
});

function tokenExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    if (!payload) return Date.now() + 5 * 60_000;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims: unknown = JSON.parse(atob(normalized));
    return typeof claims === "object" &&
      claims !== null &&
      "exp" in claims &&
      typeof claims.exp === "number"
      ? claims.exp * 1000
      : Date.now() + 5 * 60_000;
  } catch {
    return Date.now() + 5 * 60_000;
  }
}

/** Development may skip App Check only when the server uses the same opt-out. */
function appCheckOptional(): boolean {
  return (
    !isProduction &&
    (process.env.APP_CHECK_ENFORCE === "false" || !process.env.NEXT_PUBLIC_APPCHECK_TURNSTILE_SITE_KEY)
  );
}

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined")
    throw new Error("Firebase App Check is only available in the browser.");
  if (window.turnstile) return Promise.resolve();
  appCheckRuntime.turnstileScript ??= new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script#cloudflare-turnstile-script");
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.id = "cloudflare-turnstile-script";
      script.async = true;
      applyCspNonce(script);
    }
    if (!script.nonce) {
      reject(new Error("Turnstile script nonce is unavailable."));
      return;
    }
    script.addEventListener(
      "load",
      () => {
        if (window.turnstile) resolve();
        else reject(new Error("Turnstile did not initialize."));
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        reject(new Error("Turnstile could not load."));
      },
      { once: true },
    );
    if (!existing) document.head.appendChild(script);
  }).catch((cause: unknown) => {
    appCheckRuntime.turnstileScript = null;
    throw cause;
  });
  return appCheckRuntime.turnstileScript;
}

function requestTurnstileProof(): Promise<string> {
  const siteKey = process.env.NEXT_PUBLIC_APPCHECK_TURNSTILE_SITE_KEY;
  if (!siteKey) return Promise.reject(new Error("Turnstile is not configured."));
  return loadTurnstileScript().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const host = document.createElement("div");
        host.setAttribute("aria-hidden", "true");
        document.body.appendChild(host);
        let widgetId = "";
        let timeoutId: number | undefined;
        let settled = false;
        const finish = (token?: string) => {
          if (settled) return;
          settled = true;
          if (timeoutId !== undefined) window.clearTimeout(timeoutId);
          if (widgetId) {
            try {
              window.turnstile?.remove(widgetId);
            } catch {
              // Cleanup must not prevent resolving or rejecting token acquisition.
            }
          }
          host.remove();
          if (token) resolve(token);
          else reject(new Error("Turnstile verification failed."));
        };
        try {
          const turnstile = window.turnstile;
          if (!turnstile) throw new Error("Turnstile did not initialize.");
          widgetId = turnstile.render(host, {
            sitekey: siteKey,
            execution: "execute",
            callback: (token) => {
              finish(token);
            },
            "expired-callback": () => {
              finish();
            },
            "error-callback": (errorCode) => {
              console.error("appCheck/turnstile-widget", errorCode);
              finish();
            },
          });
          timeoutId = window.setTimeout(() => {
            finish();
          }, 120_000);
          turnstile.execute(widgetId);
        } catch {
          finish();
        }
      }),
  );
}

type AppCheckTokenPayload = { token: string; expireTimeMillis: number };

function isAppCheckTokenPayload(value: unknown): value is AppCheckTokenPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "token" in value &&
    typeof value.token === "string" &&
    "expireTimeMillis" in value &&
    typeof value.expireTimeMillis === "number"
  );
}

function safeEndpointLabel(payload: unknown, key: "stage" | "reason", fallback: string): string {
  if (typeof payload !== "object" || payload === null || !(key in payload)) return fallback;
  const value: unknown = Reflect.get(payload, key);
  return typeof value === "string" ? value.slice(0, 40) : fallback;
}

function reportTokenEndpointFailure(response: Response, payload: unknown): void {
  console.error(
    "appCheck/token-endpoint",
    response.status,
    safeEndpointLabel(payload, "stage", "unknown"),
    safeEndpointLabel(payload, "reason", ""),
  );
}

async function fetchCustomAppCheckToken(): Promise<AppCheckTokenPayload> {
  const turnstileToken = await requestTurnstileProof();
  const response = await fetch("/api/app-check/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ turnstileToken }),
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) reportTokenEndpointFailure(response, payload);
  if (!response.ok || !isAppCheckTokenPayload(payload))
    throw new AppCheckTokenError("appCheck/turnstile-error");
  return payload;
}

function appCheck(): Promise<AppCheck> {
  if (typeof window === "undefined")
    throw new Error("Firebase App Check is only available in the browser.");
  appCheckRuntime.initialization ??= loadTurnstileScript()
    .then(() => {
      appCheckRuntime.instance = initializeAppCheck(firebaseApp, {
        provider: new CustomProvider({ getToken: fetchCustomAppCheckToken }),
        isTokenAutoRefreshEnabled: true,
      });
      return appCheckRuntime.instance;
    })
    .catch((cause: unknown) => {
      appCheckRuntime.initialization = null;
      throw cause;
    });
  return appCheckRuntime.initialization;
}

async function readAppCheckToken(): Promise<string> {
  if (appCheckRuntime.cachedToken && appCheckRuntime.tokenExpiresAt > Date.now() + 60_000)
    return appCheckRuntime.cachedToken;
  appCheckRuntime.tokenRequest ??= appCheck()
    .then((instance) => getToken(instance, false))
    .then((result) => {
      if (!result.token) throw new Error("App Check token unavailable.");
      appCheckRuntime.cachedToken = result.token;
      appCheckRuntime.tokenExpiresAt = tokenExpiry(result.token);
      return appCheckRuntime.cachedToken;
    })
    .finally(() => {
      appCheckRuntime.tokenRequest = null;
    });
  return appCheckRuntime.tokenRequest;
}

export async function appCheckHeaders(): Promise<Record<string, string>> {
  if (appCheckOptional()) return {};
  try {
    return { "X-Firebase-AppCheck": await readAppCheckToken() };
  } catch (cause) {
    const code = appCheckFailureCode(cause) ?? "appCheck/token-unavailable";
    console.error(code);
    throw new AppCheckTokenError(code);
  }
}
