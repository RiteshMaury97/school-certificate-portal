import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getAppCheck } from "firebase-admin/app-check";

function serviceAccount(): Record<string, unknown> | null {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) return null;
  return JSON.parse(Buffer.from(encoded, "base64").toString("utf8")) as Record<
    string,
    unknown
  >;
}
const credentials = serviceAccount();
const app =
  getApps()[0] ??
  initializeApp({
    ...(credentials
      ? { credential: cert(credentials as Parameters<typeof cert>[0]) }
      : {}),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
export const adminAuth = getAuth(app);
export const adminAppCheck = getAppCheck(app);
export const db = getFirestore(app);
