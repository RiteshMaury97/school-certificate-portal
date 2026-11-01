import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is required");
const app =
  getApps()[0] ??
  initializeApp({
    credential: cert(JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))),
  });
const auth = getAuth(app),
  db = getFirestore(app);
const oldAdmins = await db.collection("admins").where("role", "==", "admin").get();
for (const doc of oldAdmins.docs) {
  await doc.ref.update({ role: "approver", migratedRoleAt: new Date() });
  const user = await auth.getUser(doc.id);
  await auth.setCustomUserClaims(doc.id, {
    ...user.customClaims,
    role: "approver",
  });
  process.stdout.write(`Migrated ${doc.id} to approver\n`);
}
process.stdout.write(
  `Migrated ${oldAdmins.size} legacy admin records. Users must sign in again.\n`,
);
await app.delete();
