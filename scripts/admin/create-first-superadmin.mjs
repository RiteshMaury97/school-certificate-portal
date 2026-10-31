import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const email = process.argv[2]?.trim().toLowerCase();
const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error("Usage: node scripts/admin/create-first-superadmin.mjs verified-admin@school.example");
}
if (!encoded || !projectId) throw new Error("Set FIREBASE_SERVICE_ACCOUNT_BASE64 and FIREBASE_PROJECT_ID.");
const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
const app = getApps()[0] ?? initializeApp({ credential: cert(credentials), projectId });
const auth = getAuth(app);
const db = getFirestore(app);
const user = await auth.getUserByEmail(email);
if (!user.emailVerified) throw new Error("The Firebase Auth user must have a verified email before promotion.");
const existing = await db.collection("admins").doc(user.uid).get();
if (existing.exists && existing.get("role") === "superadmin") {
  console.log(`Already provisioned: ${email}`);
  process.exit(0);
}
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: "superadmin" });
await db.collection("admins").doc(user.uid).set({
  uid: user.uid, email, role: "superadmin", status: "active",
  createdAt: existing.get("createdAt") ?? FieldValue.serverTimestamp(),
  provisionedAt: FieldValue.serverTimestamp()
}, { merge: true });
console.log(`Created superadmin record for ${email} (${user.uid}). Sign out and sign in again to refresh claims.`);
