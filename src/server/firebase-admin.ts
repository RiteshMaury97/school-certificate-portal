/* eslint-disable @typescript-eslint/no-unused-vars -- reason: Firebase SDK callback generics contain intentionally unused parameters. */
import "server-only";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { assertServerEnvironment } from "./env";

type ServiceAccountInput = Parameters<typeof cert>[0];
type FirebaseServices = {
  adminAuth: ReturnType<typeof getAuth>;
  adminAppCheck: ReturnType<typeof getAppCheck>;
  db: ReturnType<typeof getFirestore>;
};

let services: FirebaseServices | null = null;
let usingExplicitCredentials = false;

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
  assertServerEnvironment();
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
  usingExplicitCredentials = serviceAccount !== null;
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

function lazyService<K extends keyof FirebaseServices>(name: K): FirebaseServices[K] {
  return new Proxy({} as FirebaseServices[K], {
    get(_target, property) {
      const service = getFirebaseServices()[name];
      const value = Reflect.get(service, property, service);
      return typeof value === "function" ? value.bind(service) : value;
    },
  });
}

export const adminAuth = lazyService("adminAuth");
export const adminAppCheck = lazyService("adminAppCheck");
export const db = lazyService("db");

/**
 * Turns a Firebase/Google error into a short, secret-free line for server logs,
 * with a hint for the misconfigurations that most often cause outages.
 */
export function describeFirebaseError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code = firebaseErrorCode(error);
  const message = raw.replace(/\s+/g, " ").slice(0, 220);
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const hasExplicitCredentials = Boolean(
    process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim() ||
      (process.env.FIREBASE_CLIENT_EMAIL?.trim() && process.env.FIREBASE_PRIVATE_KEY?.trim()),
  );
  let hint = "";
  if (
    /default credentials|could not load/i.test(raw) ||
    (!hasExplicitCredentials && /UNAUTHENTICATED|16/.test(String(code)))
  )
    hint =
      " | HINT: no Firebase Admin credentials were found. Set FIREBASE_SERVICE_ACCOUNT_BASE64 " +
      "(or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY) in the server environment.";
  else if (/NOT_FOUND|5 NOT_FOUND/.test(raw) || String(code) === "5")
    hint =
      " | HINT: the Firestore database does not exist for this project. Create it in the Firebase console.";
  else if (/PERMISSION_DENIED|7 PERMISSION/.test(raw) || String(code) === "7")
    hint =
      " | HINT: the service account lacks Firestore access (needs the 'Cloud Datastore User' role).";
  else if (!projectId) hint = " | HINT: FIREBASE_PROJECT_ID is not set.";
  return `${code === undefined ? "" : `[${String(code)}] `}${message}${hint}`;
}
