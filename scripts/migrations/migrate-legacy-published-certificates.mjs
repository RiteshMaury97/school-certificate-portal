import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is required");
const app =
  getApps()[0] ??
  initializeApp({
    credential: cert(
      JSON.parse(Buffer.from(encoded, "base64").toString("utf8")),
    ),
  });
const db = getFirestore(app);
const snapshot = await db.collection("certificates").get();
let migrated = 0;
for (const doc of snapshot.docs) {
  if (doc.get("status") === undefined && doc.get("published") !== false) {
    await doc.ref.update({
      status: "published",
      published: true,
      migratedPublicationStatusAt: FieldValue.serverTimestamp(),
    });
    migrated++;
  }
}
console.log(
  `Marked ${migrated} legacy records as published. Records with explicit non-published flags were not changed.`,
);
await app.delete();
