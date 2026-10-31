import { createCipheriv, createHmac, randomBytes } from "node:crypto";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const encryptionKey = Buffer.from(
  process.env.STUDENT_PII_ENCRYPTION_KEY ?? "",
  "base64",
);
const hmacSecret = Buffer.from(
  process.env.DISAMBIGUATION_HMAC_SECRET ?? "",
  "utf8",
);
if (!encoded) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is required");
if (encryptionKey.length !== 32)
  throw new Error(
    "STUDENT_PII_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
  );
if (hmacSecret.length < 32)
  throw new Error("DISAMBIGUATION_HMAC_SECRET must be at least 32 bytes");
const execute = process.argv.includes("--execute");
const app =
  getApps()[0] ??
  initializeApp({
    credential: cert(
      JSON.parse(Buffer.from(encoded, "base64").toString("utf8")),
    ),
  });
const db = getFirestore(app);
function normalize(value) {
  const normalized = String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  const dmy = normalized.match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})$/);
  return dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : normalized;
}
function digest(value) {
  return createHmac("sha256", hmacSecret)
    .update(normalize(value), "utf8")
    .digest("hex");
}
function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(normalize(value), "utf8"),
    cipher.final(),
  ]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
let scanned = 0,
  changed = 0;
let cursor;
for (;;) {
  let query = db.collection("students").orderBy("__name__").limit(300);
  if (cursor) query = query.startAfter(cursor);
  const page = await query.get();
  if (page.empty) break;
  const batch = db.batch();
  let pageChanged = 0;
  for (const doc of page.docs) {
    scanned += 1;
    const data = doc.data();
    const update = {};
    const legacyAdmission =
      typeof data.admissionNo === "string" && data.admissionNo.trim()
        ? data.admissionNo
        : "";
    const admissionValue =
      legacyAdmission ||
      (typeof data.admissionNumber === "string" &&
      data.admissionNumber.trim() &&
      !data.admissionNumber.startsWith("v1.")
        ? data.admissionNumber
        : "");
    if (admissionValue) {
      update.admissionNumber = encrypt(admissionValue);
      update.admissionNumberDisambiguationKey = digest(admissionValue);
    }
    if (typeof data.admissionNo === "string")
      update.admissionNo = FieldValue.delete();
    if (
      typeof data.dateOfBirth === "string" &&
      data.dateOfBirth.trim() &&
      !data.dateOfBirth.startsWith("v1.")
    ) {
      update.dateOfBirth = encrypt(data.dateOfBirth);
      update.dateOfBirthDisambiguationKey = digest(data.dateOfBirth);
    }
    if (Object.keys(update).length) {
      update.piiMigratedAt = FieldValue.serverTimestamp();
      changed += 1;
      pageChanged += 1;
      if (execute) batch.update(doc.ref, update);
    }
  }
  if (execute && pageChanged) await batch.commit();
  cursor = page.docs.at(-1);
  if (page.size < 300) break;
}
console.log(
  `${execute ? "Updated" : "DRY RUN — would update"} ${changed} of ${scanned} student records.`,
);
if (!execute)
  console.log(
    "Review the count, back up Firestore, then rerun with --execute.",
  );
await app.delete();
