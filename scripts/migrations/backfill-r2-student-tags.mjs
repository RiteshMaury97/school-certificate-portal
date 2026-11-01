import {
  S3Client,
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const service = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const account = process.env.R2_ACCOUNT_ID,
  key = process.env.R2_ACCESS_KEY_ID,
  secret = process.env.R2_SECRET_ACCESS_KEY,
  bucket = process.env.R2_BUCKET;
if (!service) throw new Error("FIREBASE_SERVICE_ACCOUNT_BASE64 is required");
if (!account || !key || !secret || !bucket)
  throw new Error(
    "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET are required",
  );
const execute = process.argv.includes("--execute");
const app =
  getApps()[0] ??
  initializeApp({
    credential: cert(JSON.parse(Buffer.from(service, "base64").toString("utf8"))),
  });
const db = getFirestore(app);
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${account}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: { accessKeyId: key, secretAccessKey: secret },
});
const hashOwners = new Map(),
  activeKeys = new Map();
const certs = await db.collection("certificates").get();
for (const doc of certs.docs) {
  const studentId = String(doc.get("studentId") ?? ""),
    sha = String(doc.get("sha256") ?? ""),
    r2Key = String(doc.get("r2Key") ?? "");
  if (studentId && sha) {
    const owners = hashOwners.get(sha) ?? new Set();
    owners.add(studentId);
    hashOwners.set(sha, owners);
  }
  if (studentId && r2Key) activeKeys.set(r2Key, studentId);
}
let scanned = 0,
  taggable = 0,
  tagged = 0,
  ambiguous = 0,
  unattributed = 0;
async function tag(key, studentId) {
  scanned++;
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  if (head.Metadata?.studentid) {
    if (head.Metadata.studentid !== studentId) ambiguous++;
    return;
  }
  if (!studentId) {
    unattributed++;
    return;
  }
  taggable++;
  if (!execute) return;
  const source = `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: key,
      CopySource: source,
      MetadataDirective: "REPLACE",
      Metadata: { ...(head.Metadata ?? {}), studentid: studentId },
      ContentType: head.ContentType,
      CacheControl: head.CacheControl,
      ContentDisposition: head.ContentDisposition,
      ContentEncoding: head.ContentEncoding,
      ContentLanguage: head.ContentLanguage,
      Expires: head.Expires,
    }),
  );
  tagged++;
}
for (const [key, studentId] of activeKeys) {
  await tag(key, studentId);
}
let token;
do {
  const page = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "_soft-delete/",
      ContinuationToken: token,
      MaxKeys: 500,
    }),
  );
  for (const object of page.Contents ?? []) {
    if (!object.Key) continue;
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: object.Key }));
    if (head.Metadata?.studentid) continue;
    scanned++;
    const sha = head.Metadata?.sha256 ?? "";
    const owners = hashOwners.get(sha);
    if (!owners || owners.size === 0) unattributed++;
    if (owners && owners.size > 1) ambiguous++;
    if (!owners || owners.size !== 1) {
      continue;
    }
    const studentId = [...owners][0];
    taggable++;
    if (!execute) continue;
    const source = `${bucket}/${object.Key.split("/").map(encodeURIComponent).join("/")}`;
    await s3.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: object.Key,
        CopySource: source,
        MetadataDirective: "REPLACE",
        Metadata: { ...(head.Metadata ?? {}), studentid: studentId },
        ContentType: head.ContentType,
        CacheControl: head.CacheControl,
        ContentDisposition: head.ContentDisposition,
        ContentEncoding: head.ContentEncoding,
        ContentLanguage: head.ContentLanguage,
        Expires: head.Expires,
      }),
    );
    tagged++;
  }
  token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);
process.stdout.write(
  `${JSON.stringify(
    {
      mode: execute ? "execute" : "dry-run",
      activeCertificateKeys: activeKeys.size,
      scanned,
      taggable,
      tagged,
      ambiguous,
      unattributed,
    },
    null,
    2,
  )}\n`,
);
if (!execute)
  process.stdout.write(
    "Dry run only. Back up R2 and Firestore, review ambiguous/unattributed objects, then rerun with --execute.\n",
  );
await app.delete();
await s3.destroy();
