import { randomUUID } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!encoded)
  throw new Error(
    "Set FIREBASE_SERVICE_ACCOUNT_BASE64 before running this migration.",
  );
const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
const app =
  getApps()[0] ??
  initializeApp({
    credential: cert(credentials),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
const db = getFirestore(app);

async function main() {
  let cursor;
  let updated = 0;
  for (;;) {
    let query = db.collection("certificates").orderBy("__name__").limit(400);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    const batch = db.batch();
    for (const doc of page.docs) {
      const publicId = doc.get("publicId");
      if (typeof publicId === "string" && publicId.length >= 20) continue;
      batch.update(doc.ref, { publicId: randomUUID().replace(/-/g, "") });
      updated += 1;
    }
    await batch.commit();
    cursor = page.docs[page.docs.length - 1];
  }
  process.stdout.write(
    `Backfilled public IDs on ${updated} certificate records.\n`,
  );
}
main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Migration failed"}\n`,
  );
  process.exitCode = 1;
});
