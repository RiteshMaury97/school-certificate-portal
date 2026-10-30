"use client";
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  getToken,
  type AppCheck,
} from "firebase/app-check";
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
export const firebaseApp = getApps().length
  ? getApps()[0]!
  : initializeApp(config);
export const auth = getAuth(firebaseApp);
let appCheckInstance: AppCheck | null = null;
function appCheck(): AppCheck {
  if (typeof window === "undefined")
    throw new Error("Firebase App Check is only available in the browser.");
  if (!appCheckInstance) {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY;
    if (!siteKey)
      throw new Error("Firebase App Check site key is not configured.");
    appCheckInstance = initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  return appCheckInstance;
}
export async function appCheckHeaders(): Promise<Record<string, string>> {
  const result = await getToken(appCheck(), false);
  if (!result.token) throw new Error("Could not verify this app installation.");
  return { "X-Firebase-AppCheck": result.token };
}
