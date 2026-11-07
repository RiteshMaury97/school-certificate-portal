"use client";
import { getApps, initializeApp } from "firebase/app";
import { getToken, initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";
import { getAuth } from "firebase/auth";

function requiredFirebaseConfig(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`Missing Firebase client configuration: ${name}`);
  return normalized;
}

const config = {
  apiKey: requiredFirebaseConfig(process.env.FIREBASE_API_KEY, "FIREBASE_API_KEY"),
  authDomain: requiredFirebaseConfig(process.env.FIREBASE_AUTH_DOMAIN, "FIREBASE_AUTH_DOMAIN"),
  projectId: requiredFirebaseConfig(process.env.FIREBASE_PROJECT_ID, "FIREBASE_PROJECT_ID"),
  appId: requiredFirebaseConfig(process.env.FIREBASE_APP_ID, "FIREBASE_APP_ID"),
};

const existingApps = getApps();
export const firebaseApp = existingApps[0] ?? initializeApp(config);
export const auth = getAuth(firebaseApp);

const isProduction = process.env.NODE_ENV === "production";
let appCheckInstance: AppCheck | null = null;
let cachedAppCheckToken = "";
let appCheckTokenExpiresAt = 0;
let appCheckTokenRequest: Promise<string> | null = null;

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

/** Local development: App Check can be skipped on both ends with APP_CHECK_ENFORCE=false. */
function appCheckOptional(): boolean {
  return !isProduction && !process.env.RECAPTCHA_V3_SITE_KEY;
}

function appCheck(): AppCheck {
  if (typeof window === "undefined")
    throw new Error("Firebase App Check is only available in the browser.");
  if (!appCheckInstance) {
    const siteKey = process.env.RECAPTCHA_V3_SITE_KEY;
    if (!siteKey) throw new Error("Firebase App Check site key is not configured.");
    if (!isProduction) {
      // The debug token is printed to the console once; register it in Firebase console → App Check.
      Reflect.set(self, "FIREBASE_APPCHECK_DEBUG_TOKEN", true);
    }
    appCheckInstance = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  return appCheckInstance;
}

async function readAppCheckToken(): Promise<string> {
  if (cachedAppCheckToken && appCheckTokenExpiresAt > Date.now() + 60_000)
    return cachedAppCheckToken;
  appCheckTokenRequest ??= getToken(appCheck(), false)
    .then((result) => {
      if (!result.token) throw new Error("Could not verify this app installation.");
      cachedAppCheckToken = result.token;
      appCheckTokenExpiresAt = tokenExpiry(result.token);
      return cachedAppCheckToken;
    })
    .finally(() => { appCheckTokenRequest = null; });
  return appCheckTokenRequest;
}

export async function initializeAppCheckEarly(): Promise<void> {
  if (appCheckOptional()) return;
  try {
    await readAppCheckToken();
  } catch {
    // The sign-in request shows the actionable App Check error if initialization fails.
  }
}

export async function appCheckHeaders(): Promise<Record<string, string>> {
  if (appCheckOptional()) return {};
  return { "X-Firebase-AppCheck": await readAppCheckToken() };
}
