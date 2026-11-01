import "server-only";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type ServiceAccountInput = Parameters<typeof cert>[0];

const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeServiceAccount(encoded: string): ServiceAccountInput {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    return normalizeServiceAccount(parsed);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_BASE64 is set but is not base64-encoded service-account JSON. " +
        "Encode the file with: base64 -w0 service-account.json",
    );
  }
}

function normalizeServiceAccount(value: unknown): ServiceAccountInput {
  if (!isRecord(value)) throw new Error("Invalid service-account object");
  const parsedProjectId = value.projectId ?? value.project_id;
  const clientEmail = value.clientEmail ?? value.client_email;
  const privateKey = value.privateKey ?? value.private_key;
  if (
    (parsedProjectId !== undefined && typeof parsedProjectId !== "string") ||
    typeof clientEmail !== "string" ||
    typeof privateKey !== "string"
  ) {
    throw new Error("Invalid service-account fields");
  }
  return {
    ...(parsedProjectId ? { projectId: parsedProjectId } : {}),
    clientEmail,
    privateKey,
  };
}

/**
 * Credentials are read, in order, from:
 *  1. FIREBASE_SERVICE_ACCOUNT_BASE64  - the service-account JSON, base64-encoded
 *  2. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (+ project id)
 *  3. Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS, or the hosting platform)
 * A service-account file must never be committed to the repository.
 */
function readServiceAccount(): ServiceAccountInput | null {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim();
  if (encoded) return decodeServiceAccount(encoded);
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) return { projectId, clientEmail, privateKey };
  return null;
}

const serviceAccount = readServiceAccount();
const usingExplicitCredentials = serviceAccount !== null;

const app =
  getApps()[0] ??
  initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    ...(projectId ? { projectId } : {}),
  });

export const adminAuth = getAuth(app);
export const adminAppCheck = getAppCheck(app);
export const db = getFirestore(app);

/**
 * Turns a Firebase/Google error into a short, secret-free line for server logs,
 * with a hint for the misconfigurations that most often cause outages.
 */
export function describeFirebaseError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code = getErrorCode(error);
  const message = raw.replace(/\s+/g, " ").slice(0, 220);
  const hint = firebaseErrorHint(raw, code);
  return `${code === undefined ? "" : `[${String(code)}] `}${message}${hint}`;
}

function getErrorCode(error: unknown): string | number | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code: unknown = error.code;
  return typeof code === "string" || typeof code === "number" ? code : undefined;
}

function firebaseErrorHint(raw: string, code: string | number | undefined): string {
  if (
    /default credentials|could not load/i.test(raw) ||
    (!usingExplicitCredentials && /UNAUTHENTICATED|16/.test(String(code)))
  )
    return (
      " | HINT: no Firebase Admin credentials were found. Set FIREBASE_SERVICE_ACCOUNT_BASE64 " +
      "(or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY) in the server environment."
    );
  else if (/NOT_FOUND|5 NOT_FOUND/.test(raw) || String(code) === "5")
    return " | HINT: the Firestore database does not exist for this project. Create it in the Firebase console.";
  else if (/PERMISSION_DENIED|7 PERMISSION/.test(raw) || String(code) === "7")
    return " | HINT: the service account lacks Firestore access (needs the 'Cloud Datastore User' role).";
  if (!projectId) return " | HINT: FIREBASE_PROJECT_ID is not set.";
  return "";
}
