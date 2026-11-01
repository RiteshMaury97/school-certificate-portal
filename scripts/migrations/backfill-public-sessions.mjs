import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is required");
const app =
  getApps()[0] ??
  initializeApp({
    credential: cert(JSON.parse(Buffer.from(encoded, "base64").toString("utf8"))),
  });
const db = getFirestore(app);
const snapshot = await db.collection("certificates").where("status", "==", "published").get();
const counts = {};
for (const doc of snapshot.docs) {
  const session = String(doc.get("session") ?? "");
  if (
    /^\d{4}-\d{2}$/.test(session) &&
    doc.get("published") !== false &&
    doc.get("erasurePending") !== true
  )
    counts[session] = (counts[session] ?? 0) + 1;
}
await db
  .collection("publicSessions")
  .doc("main")
  .set({
    sessions: Object.keys(counts).sort((a, b) => b.localeCompare(a)),
    counts,
    updatedAt: FieldValue.serverTimestamp(),
  });
process.stdout.write(
  `Updated publicSessions/main for ${Object.keys(counts).length} sessions.\n`,
);
await app.delete();
