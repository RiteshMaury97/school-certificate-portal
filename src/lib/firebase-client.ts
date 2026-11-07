"use client";

import { getApps, initializeApp } from "firebase/app";
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";
import { getAuth } from "firebase/auth";

import { applyCspNonce } from "./csp";
import { AppCheckTokenError, appCheckFailureCode } from "./app-check-errors";

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
  recaptchaScript: Promise<void> | null;
  cachedToken: string;
  tokenExpiresAt: number;
  tokenRequest: Promise<string> | null;
};
type AppCheckGlobal = typeof globalThis & { __sisPortalAppCheckRuntime?: AppCheckRuntime };
const appCheckRuntime = ((globalThis as AppCheckGlobal).__sisPortalAppCheckRuntime ??= {
  instance: null,
  initialization: null,
  recaptchaScript: null,
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
    return typeof claims === "object" && claims !== null && "exp" in claims &&
      typeof claims.exp === "number" ? claims.exp * 1000 : Date.now() + 5 * 60_000;
  } catch {
    return Date.now() + 5 * 60_000;
  }
}

/** Development may skip App Check only when the server uses the same opt-out. */
function appCheckOptional(): boolean {
  return !isProduction &&
    (process.env.APP_CHECK_ENFORCE === "false" || !process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY);
}

function loadRecaptchaScript(): Promise<void> {
  if (typeof window === "undefined")
    throw new Error("Firebase App Check is only available in the browser.");
  if (Reflect.has(window, "grecaptcha")) return Promise.resolve();
  appCheckRuntime.recaptchaScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js";
    script.async = true;
    applyCspNonce(script);
    if (!script.nonce) {
      reject(new Error("reCAPTCHA script nonce is unavailable."));
      return;
    }
    script.addEventListener("load", () => {
      if (Reflect.has(window, "grecaptcha")) resolve();
      else reject(new Error("reCAPTCHA did not initialize."));
    }, { once: true });
    script.addEventListener("error", () => reject(new Error("reCAPTCHA could not load.")), {
      once: true,
    });
    document.head.appendChild(script);
  }).catch((cause: unknown) => {
    appCheckRuntime.recaptchaScript = null;
    throw cause;
  });
  return appCheckRuntime.recaptchaScript;
}

function appCheck(): Promise<AppCheck> {
  if (typeof window === "undefined")
    throw new Error("Firebase App Check is only available in the browser.");
  appCheckRuntime.initialization ??= loadRecaptchaScript().then(() => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;
    if (!siteKey) throw new Error("Firebase App Check site key is not configured.");
    appCheckRuntime.instance = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
    return appCheckRuntime.instance;
  }).catch((cause: unknown) => {
    appCheckRuntime.initialization = null;
    throw cause;
  });
  return appCheckRuntime.initialization;
}

async function readAppCheckToken(): Promise<string> {
  if (appCheckRuntime.cachedToken && appCheckRuntime.tokenExpiresAt > Date.now() + 60_000)
    return appCheckRuntime.cachedToken;
  appCheckRuntime.tokenRequest ??= appCheck().then((instance) => getToken(instance, false))
    .then((result) => {
      if (!result.token) throw new Error("App Check token unavailable.");
      appCheckRuntime.cachedToken = result.token;
      appCheckRuntime.tokenExpiresAt = tokenExpiry(result.token);
      return appCheckRuntime.cachedToken;
    })
    .finally(() => { appCheckRuntime.tokenRequest = null; });
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

export async function initializeAppCheckEarly(): Promise<void> {
  if (appCheckOptional()) return;
  try {
    await appCheckHeaders();
  } catch {
    // Sign-in reports the actionable error when the user tries to continue.
  }
}
