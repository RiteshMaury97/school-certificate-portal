import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

loadEnvConfig(process.cwd());

const uid = process.argv[2]?.trim();
const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const projectId = process.env.FIREBASE_PROJECT_ID;

if (!uid || uid.length > 128 || /\s/.test(uid)) {
  throw new Error("Usage: npm run admin:promote-superadmin -- <FIREBASE_AUTH_UID>");
}
if (!encoded || !projectId) {
  throw new Error(
    "Set FIREBASE_SERVICE_ACCOUNT_BASE64 and FIREBASE_PROJECT_ID in your server environment.",
  );
}

const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
const app = getApps()[0] ?? initializeApp({ credential: cert(credentials), projectId });
const auth = getAuth(app);
const db = getFirestore(app);

const user = await auth.getUser(uid);
if (!user.email) {
  throw new Error("The Firebase Auth user must have an email address.");
}
if (!user.emailVerified) {
  throw new Error(
    `The Firebase Auth email for UID ${uid} is not verified. Verify it before promotion.`,
  );
}

const email = user.email.trim().toLowerCase();
const adminRef = db.collection("admins").doc(user.uid);
const existing = await adminRef.get();

// Keep unrelated custom claims, while synchronizing the role used by preflight.
await auth.setCustomUserClaims(user.uid, {
  ...user.customClaims,
  role: "superadmin",
});

await adminRef.set(
  {
    uid: user.uid,
    email,
    role: "superadmin",
    status: "active",
    createdAt: existing.exists
      ? (existing.get("createdAt") ?? FieldValue.serverTimestamp())
      : FieldValue.serverTimestamp(),
    promotedAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
);

process.stdout.write(
  [
    "Superadministrator promotion completed.",
    `UID: ${user.uid}`,
    `Email: ${email}`,
    "Firestore admins/{uid}: role=superadmin, status=active",
    "Firebase custom claim: role=superadmin",
    "Next: sign out of the portal completely, then sign in again with this Google account.",
    "",
  ].join("\n"),
);
