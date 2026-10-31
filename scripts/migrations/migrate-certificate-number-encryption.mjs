import { createCipheriv, randomBytes } from "node:crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const encryptionKey = Buffer.from(
  process.env.CERTIFICATE_NUMBER_ENCRYPTION_KEY ?? "",
  "base64",
);
if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is required");
if (encryptionKey.length !== 32)
  throw new Error(
    "CERTIFICATE_NUMBER_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
  );
const execute = process.argv.includes("--execute");
const app =
  getApps()[0] ??
  initializeApp({
    credential: cert(
      JSON.parse(Buffer.from(encoded, "base64").toString("utf8")),
    ),
  });
const db = getFirestore(app);
function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(value).normalize("NFKC").trim(), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}
let scanned = 0,
  changed = 0,
  cursor;
for (;;) {
  let query = db.collection("certificates").orderBy("__name__").limit(300);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  if (page.empty) break;
  const batch = db.batch();
  let pageChanged = 0;
  for (const doc of page.docs) {
    scanned += 1;
    const data = doc.data();
    if (
      typeof data.certificateNumber === "string" &&
      data.certificateNumber.trim() &&
      !data.certificateNumberEncrypted
    ) {
      changed += 1;
      pageChanged += 1;
      if (execute)
        batch.update(doc.ref, {
          certificateNumberEncrypted: encrypt(data.certificateNumber),
          certificateNumber: FieldValue.delete(),
          certificateNumberEncryptedAt: FieldValue.serverTimestamp(),
        });
    }
  }
  if (execute && pageChanged) await batch.commit();
  cursor = page.docs.at(-1);
  if (page.size < 300) break;
}
console.log(
  `${execute ? "Encrypted" : "DRY RUN — would encrypt"} ${changed} of ${scanned} certificate records.`,
);
if (!execute) console.log("Back up Firestore, then rerun with --execute.");
await app.delete();
