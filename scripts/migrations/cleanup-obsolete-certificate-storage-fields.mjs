import { createHmac, createCipheriv, randomBytes } from "node:crypto";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const projectId = process.env.FIREBASE_PROJECT_ID;
const secret = process.env.CERTIFICATE_NUMBER_HMAC_SECRET;
const encryptionKey = Buffer.from(
  process.env.CERTIFICATE_NUMBER_ENCRYPTION_KEY ?? "",
  "base64",
);
if (
  !encoded ||
  !projectId ||
  !secret ||
  Buffer.byteLength(secret) < 32 ||
  encryptionKey.byteLength !== 32
) {
  throw new Error(
    "Firebase Admin credentials, CERTIFICATE_NUMBER_HMAC_SECRET (32+ bytes), and CERTIFICATE_NUMBER_ENCRYPTION_KEY (base64 32 bytes) are required.",
  );
}
const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
const app =
  getApps()[0] ?? initializeApp({ credential: cert(credentials), projectId });
const db = getFirestore(app);
function numberHash(value) {
  const normalized = String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  if (!normalized || normalized.length > 80)
    throw new Error("Invalid legacy certificate number");
  return createHmac("sha256", secret).update(normalized, "utf8").digest("hex");
}
function encryptNumber(value) {
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
const certificates = await db.collection("certificates").get();
const seen = new Map();
for (const document of certificates.docs) {
  const number = document.get("certificateNumber");
  if (typeof number !== "string" || !number.trim()) continue;
  const hash = numberHash(number);
  const duplicate = seen.get(hash);
  if (duplicate && duplicate !== document.id) {
    throw new Error(
      "Duplicate certificate numbers detected. Resolve duplicates before migrating the lookup index.",
    );
  }
  seen.set(hash, document.id);
}
let indexed = 0;
for (const document of certificates.docs) {
  const data = document.data();
  const number = data.certificateNumber;
  if (typeof number !== "string" || !number.trim()) {
    console.warn(
      `Certificate ${document.id} has no valid legacy certificate number; removing the plaintext field without creating a verification index.`,
    );
    await document.ref.update({ certificateNumber: FieldValue.delete() });
    continue;
  }
  const hash = numberHash(number);
  const indexRef = db.collection("certificateNumberIndex").doc(hash);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(indexRef);
    if (existing.exists && existing.get("certificateId") !== document.id) {
      throw new Error(
        "Certificate number index collision or duplicate detected.",
      );
    }
    transaction.set(
      indexRef,
      {
        certificateId: document.id,
        session: String(data.session ?? ""),
        createdAt: existing.get("createdAt") ?? FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    const patch = {
      certificateNumberEncrypted: encryptNumber(number),
      certificateNumber: FieldValue.delete(),
      driveFileId: FieldValue.delete(),
      driveFolderId: FieldValue.delete(),
    };
    transaction.update(document.ref, patch);
  });
  indexed++;
}
for (const collection of ["sessions", "certificateTypes"]) {
  const docs = await db.collection(collection).get();
  for (const document of docs.docs) {
    const fields =
      collection === "sessions"
        ? ["driveFolderId", "typeFolderIds"]
        : ["driveFolderId"];
    const patch = Object.fromEntries(
      fields.map((field) => [field, FieldValue.delete()]),
    );
    await document.ref.update(patch);
  }
}
process.stdout.write(
  `Migrated ${indexed} certificate number(s) into HMAC lookup indexes, AES-256-GCM encrypted the stored values, and removed plaintext/legacy storage fields.\n`,
);
