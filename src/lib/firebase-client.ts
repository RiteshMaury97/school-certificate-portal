"use client";
import { getApps, initializeApp } from "firebase/app";
import {
  getToken,
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from "firebase/app-check";
import { getAuth } from "firebase/auth";

function requiredFirebaseConfig(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`Missing Firebase client configuration: ${name}`);
  return normalized;
}

const config = {
  apiKey: requiredFirebaseConfig(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    "NEXT_PUBLIC_FIREBASE_API_KEY",
  ),
  authDomain: requiredFirebaseConfig(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  ),
  projectId: requiredFirebaseConfig(
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  ),
  appId: requiredFirebaseConfig(
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ),
};

const existingApps = getApps();
export const firebaseApp = existingApps[0] ?? initializeApp(config);
export const auth = getAuth(firebaseApp);

const isProduction = process.env.NODE_ENV === "production";
let appCheckInstance: AppCheck | null = null;

/** Local development: App Check can be skipped on both ends with APP_CHECK_ENFORCE=false. */
function appCheckOptional(): boolean {
  return !isProduction && !process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;
}

function appCheck(): AppCheck {
  if (typeof window === "undefined")
    throw new Error("Firebase App Check is only available in the browser.");
  if (!appCheckInstance) {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;
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

export async function appCheckHeaders(): Promise<Record<string, string>> {
  if (appCheckOptional()) return {};
  const result = await getToken(appCheck(), false);
  if (!result.token) throw new Error("Could not verify this app installation.");
  return { "X-Firebase-AppCheck": result.token };
}
