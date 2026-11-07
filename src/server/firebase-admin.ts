import "server-only";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { assertEnvironmentFor } from "./env";

type ServiceAccountInput = Parameters<typeof cert>[0];

const FIREBASE_ENVIRONMENT_NAMES = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_SERVICE_ACCOUNT_BASE64",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
] as const;
type FirebaseServices = {
  adminAuth: ReturnType<typeof getAuth>;
  adminAppCheck: ReturnType<typeof getAppCheck>;
  db: ReturnType<typeof getFirestore>;
};

let services: FirebaseServices | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function serviceAccountFromJson(value: unknown): ServiceAccountInput {
  if (!isRecord(value)) throw new Error("Invalid service-account JSON");
  const projectIdValue = value.projectId ?? value.project_id;
  const clientEmailValue = value.clientEmail ?? value.client_email;
  const privateKeyValue = value.privateKey ?? value.private_key;
  return {
    ...(typeof projectIdValue === "string" ? { projectId: projectIdValue } : {}),
    ...(typeof clientEmailValue === "string" ? { clientEmail: clientEmailValue } : {}),
    ...(typeof privateKeyValue === "string" ? { privateKey: privateKeyValue } : {}),
  };
}

function firebaseErrorCode(error: unknown): string | number | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  const code: unknown = error.code;
  return typeof code === "string" || typeof code === "number" ? code : undefined;
}

/**
 * Credentials are read, in order, from:
 *  1. FIREBASE_SERVICE_ACCOUNT_BASE64  - the service-account JSON, base64-encoded
 *  2. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (+ project id)
 *  3. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS, or the hosting platform)
 * A service-account file must never be committed to the repository.
 */
function readServiceAccount(): ServiceAccountInput | null {
  assertEnvironmentFor("Firebase Admin", FIREBASE_ENVIRONMENT_NAMES);
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (encoded) {
    try {
      const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
      return serviceAccountFromJson(parsed);
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT_BASE64 is set but is not base64-encoded service-account JSON. " +
          "Encode the file with: base64 -w0 service-account.json",
      );
    }
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) return { projectId, clientEmail, privateKey };
  return null;
}

function getFirebaseServices(): FirebaseServices {
  if (services) return services;
  const serviceAccount = readServiceAccount();
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const app =
    getApps()[0] ??
    initializeApp({
      credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
      ...(projectId ? { projectId } : {}),
    });
  services = {
    adminAuth: getAuth(app),
    adminAppCheck: getAppCheck(app),
    db: getFirestore(app),
  };
  return services;
}

export const adminAuth = {
  createSessionCookie: (...args: Parameters<FirebaseServices["adminAuth"]["createSessionCookie"]>) =>
    getFirebaseServices().adminAuth.createSessionCookie(...args),
  createUser: (...args: Parameters<FirebaseServices["adminAuth"]["createUser"]>) =>
    getFirebaseServices().adminAuth.createUser(...args),
  deleteUser: (...args: Parameters<FirebaseServices["adminAuth"]["deleteUser"]>) =>
    getFirebaseServices().adminAuth.deleteUser(...args),
  generateEmailVerificationLink: (...args: Parameters<FirebaseServices["adminAuth"]["generateEmailVerificationLink"]>) =>
    getFirebaseServices().adminAuth.generateEmailVerificationLink(...args),
  generatePasswordResetLink: (...args: Parameters<FirebaseServices["adminAuth"]["generatePasswordResetLink"]>) =>
    getFirebaseServices().adminAuth.generatePasswordResetLink(...args),
  getUser: (...args: Parameters<FirebaseServices["adminAuth"]["getUser"]>) =>
    getFirebaseServices().adminAuth.getUser(...args),
  revokeRefreshTokens: (...args: Parameters<FirebaseServices["adminAuth"]["revokeRefreshTokens"]>) =>
    getFirebaseServices().adminAuth.revokeRefreshTokens(...args),
  setCustomUserClaims: (...args: Parameters<FirebaseServices["adminAuth"]["setCustomUserClaims"]>) =>
    getFirebaseServices().adminAuth.setCustomUserClaims(...args),
  updateUser: (...args: Parameters<FirebaseServices["adminAuth"]["updateUser"]>) =>
    getFirebaseServices().adminAuth.updateUser(...args),
  verifyIdToken: (...args: Parameters<FirebaseServices["adminAuth"]["verifyIdToken"]>) =>
    getFirebaseServices().adminAuth.verifyIdToken(...args),
  verifySessionCookie: (...args: Parameters<FirebaseServices["adminAuth"]["verifySessionCookie"]>) =>
    getFirebaseServices().adminAuth.verifySessionCookie(...args),
};

export const adminAppCheck = {
  verifyToken: (...args: Parameters<FirebaseServices["adminAppCheck"]["verifyToken"]>) =>
    getFirebaseServices().adminAppCheck.verifyToken(...args),
};

export const db = {
  batch: (...args: Parameters<FirebaseServices["db"]["batch"]>) =>
    getFirebaseServices().db.batch(...args),
  collection: (...args: Parameters<FirebaseServices["db"]["collection"]>) =>
    getFirebaseServices().db.collection(...args),
  listCollections: (...args: Parameters<FirebaseServices["db"]["listCollections"]>) =>
    getFirebaseServices().db.listCollections(...args),
  runTransaction: <T>(
    updateFunction: (transaction: FirebaseFirestore.Transaction) => Promise<T>,
  ) => getFirebaseServices().db.runTransaction(updateFunction),
};

/**
 * Turns a Firebase/Google error into a short, secret-free line for server logs,
 * with a hint for the misconfigurations that most often cause outages.
 */
function firebaseErrorHint(
  raw: string,
  code: string | number | undefined,
  projectId: string | undefined,
): string {
  const hasExplicitCredentials =
    Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim()) ||
    Boolean(process.env.FIREBASE_CLIENT_EMAIL?.trim() && process.env.FIREBASE_PRIVATE_KEY?.trim());
  if (hasMissingCredentialsHint(raw, code, hasExplicitCredentials)) return missingCredentialsHint;
  if (hasFirestoreNotFoundHint(raw, code)) return firestoreNotFoundHint;
  if (hasFirestorePermissionHint(raw, code)) return firestorePermissionHint;
  return projectId ? "" : " | HINT: FIREBASE_PROJECT_ID is not set.";
}

const missingCredentialsHint =
  " | HINT: no Firebase Admin credentials were found. Set FIREBASE_SERVICE_ACCOUNT_BASE64 (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY) in the server environment.";
const firestoreNotFoundHint =
  " | HINT: the Firestore database does not exist for this project. Create it in the Firebase console.";
const firestorePermissionHint =
  " | HINT: the service account lacks Firestore access (needs the 'Cloud Datastore User' role).";

function hasMissingCredentialsHint(
  raw: string,
  code: string | number | undefined,
  hasExplicitCredentials: boolean,
): boolean {
  return /default credentials|could not load/i.test(raw) ||
    (!hasExplicitCredentials && /UNAUTHENTICATED|16/.test(String(code)));
}

function hasFirestoreNotFoundHint(raw: string, code: string | number | undefined): boolean {
  return /NOT_FOUND|5 NOT_FOUND/.test(raw) || String(code) === "5";
}

function hasFirestorePermissionHint(raw: string, code: string | number | undefined): boolean {
  return /PERMISSION_DENIED|7 PERMISSION/.test(raw) || String(code) === "7";
}

export function describeFirebaseError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code = firebaseErrorCode(error);
  const message = raw.replace(/\s+/g, " ").slice(0, 220);
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const hint = firebaseErrorHint(raw, code, projectId);
  return `${code === undefined ? "" : `[${String(code)}] `}${message}${hint}`;
}
