import { createDecipheriv } from "node:crypto";
import { writeFile } from "node:fs/promises";

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const required = [
  "RESTORE_STAGING_PROJECT_ID",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_SERVICE_ACCOUNT_BASE64",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "BACKUP_R2_BUCKET",
  "R2_BUCKET",
  "EXPORT_ENCRYPTION_KEY",
];
for (const name of required)
  if (!process.env[name])
    throw new Error(`Missing required environment variable: ${name}`);

const targetProject = process.env.RESTORE_STAGING_PROJECT_ID;
if (!/(^|[-_])staging($|[-_])/i.test(targetProject)) {
  throw new Error(
    "Safety stop: RESTORE_STAGING_PROJECT_ID must clearly identify a staging project (include 'staging').",
  );
}
if (process.env.FIREBASE_PROJECT_ID !== targetProject) {
  throw new Error(
    "Safety stop: FIREBASE_PROJECT_ID must exactly match RESTORE_STAGING_PROJECT_ID.",
  );
}
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString(
    "utf8",
  ),
);
if (serviceAccount.project_id !== targetProject) {
  throw new Error(
    "Safety stop: the service-account project_id does not match the staging project.",
  );
}
if (process.env.BACKUP_R2_BUCKET === process.env.R2_BUCKET) {
  throw new Error(
    "Safety stop: BACKUP_R2_BUCKET must be separate from the certificate R2_BUCKET.",
  );
}

const encryptionKey = Buffer.from(process.env.EXPORT_ENCRYPTION_KEY, "base64");
if (encryptionKey.length !== 32)
  throw new Error("EXPORT_ENCRYPTION_KEY must decode to exactly 32 bytes.");

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

let continuationToken;
const backups = [];
do {
  const page = await client.send(
    new ListObjectsV2Command({
      Bucket: process.env.BACKUP_R2_BUCKET,
      Prefix: "scheduled/",
      ContinuationToken: continuationToken,
      MaxKeys: 500,
    }),
  );
  backups.push(
    ...(page.Contents ?? []).filter(
      (item) => item.Key?.endsWith("-portal-export.enc") && item.LastModified,
    ),
  );
  continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (continuationToken);
backups.sort((a, b) => b.LastModified.getTime() - a.LastModified.getTime());
const latest = backups[0];
if (!latest?.Key)
  throw new Error(
    "No scheduled encrypted portal backup was found in the separate backup bucket.",
  );

const object = await client.send(
  new GetObjectCommand({
    Bucket: process.env.BACKUP_R2_BUCKET,
    Key: latest.Key,
  }),
);
if (!object.Body) throw new Error("The selected backup object has no body.");
const encryptedEnvelope = Buffer.from(
  await object.Body.transformToByteArray(),
).toString("utf8");
const envelope = JSON.parse(encryptedEnvelope);
if (
  envelope.version !== 1 ||
  envelope.algorithm !== "AES-256-GCM" ||
  envelope.kdf !== "env-key" ||
  envelope.format !== "json"
) {
  throw new Error(
    "Unsupported backup envelope. The scheduled restore test expects an AES-256-GCM JSON export using EXPORT_ENCRYPTION_KEY.",
  );
}

const decipher = createDecipheriv(
  "aes-256-gcm",
  encryptionKey,
  Buffer.from(envelope.iv, "base64"),
);
decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
const plaintext = Buffer.concat([
  decipher.update(Buffer.from(envelope.ciphertext, "base64")),
  decipher.final(),
]);
const exportData = JSON.parse(plaintext.toString("utf8"));
if (
  !exportData ||
  typeof exportData.collections !== "object" ||
  Array.isArray(exportData.collections)
) {
  throw new Error(
    "The decrypted backup does not contain a valid collections object.",
  );
}

const app =
  getApps()[0] ??
  initializeApp({ credential: cert(serviceAccount), projectId: targetProject });
const db = getFirestore(app);
// Refuse to merge into an existing dataset: the test target must be a clean staging project.
for (const collectionName of Object.keys(exportData.collections)) {
  const existing = await db.collection(collectionName).limit(1).get();
  if (!existing.empty) {
    await app.delete();
    throw new Error(
      `Safety stop: staging collection ${collectionName} is not empty. Use a fresh, dedicated staging project.`,
    );
  }
}
const expectedCounts = {};
const restoredCounts = {};
let batch = db.batch();
let pending = 0;
let total = 0;

for (const [collectionName, rows] of Object.entries(exportData.collections)) {
  if (!Array.isArray(rows))
    throw new Error(`Invalid collection payload for ${collectionName}.`);
  expectedCounts[collectionName] = rows.length;
  restoredCounts[collectionName] = 0;
  for (const row of rows) {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.id !== "string" ||
      !row.id
    ) {
      throw new Error(
        `Invalid document in collection ${collectionName}; every exported row must have a string id.`,
      );
    }
    const { id, ...data } = row;
    batch.set(db.collection(collectionName).doc(id), data);
    pending++;
    total++;
    if (pending >= 400) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }
}
if (pending) await batch.commit();

// Verify the exact document counts for each imported top-level collection.
for (const collectionName of Object.keys(expectedCounts)) {
  const snapshot = await db.collection(collectionName).count().get();
  restoredCounts[collectionName] = snapshot.data().count;
  if (restoredCounts[collectionName] !== expectedCounts[collectionName]) {
    throw new Error(
      `Count mismatch for ${collectionName}: expected ${expectedCounts[collectionName]}, found ${restoredCounts[collectionName]}.`,
    );
  }
}

const report = {
  testedAt: new Date().toISOString(),
  targetProject,
  backupBucket: process.env.BACKUP_R2_BUCKET,
  backupObjectKey: latest.Key,
  backupLastModified: latest.LastModified.toISOString(),
  collections: Object.fromEntries(
    Object.keys(expectedCounts)
      .sort()
      .map((name) => [
        name,
        {
          expected: expectedCounts[name],
          restored: restoredCounts[name],
          match: expectedCounts[name] === restoredCounts[name],
        },
      ]),
  ),
  totalDocuments: total,
  result: "PASS",
  note: "Top-level Firestore collection counts verified. This script does not restore R2 certificate file bytes or nested subcollections.",
};
const reportJson = `${JSON.stringify(report, null, 2)}\n`;
if (process.env.RESTORE_TEST_LOG)
  await writeFile(process.env.RESTORE_TEST_LOG, reportJson, { mode: 0o600 });
process.stdout.write(reportJson);
await app.delete();
