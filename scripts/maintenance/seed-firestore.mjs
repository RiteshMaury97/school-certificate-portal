import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!encoded || !projectId)
  throw new Error("Set FIREBASE_SERVICE_ACCOUNT_BASE64 and FIREBASE_PROJECT_ID.");
const credentials = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
const app = getApps()[0] ?? initializeApp({ credential: cert(credentials), projectId });
const db = getFirestore(app);

const sessions = (process.env.SEED_SESSIONS || "2026-27")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const types = (
  process.env.SEED_CERTIFICATE_TYPES ||
  "Transfer Certificate,Character Certificate,Migration Certificate"
)
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const slugify = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

for (const session of sessions) {
  if (!/^\d{4}-\d{2}$/.test(session)) throw new Error(`Invalid session format: ${session}`);
  await db.collection("sessions").doc(session).set(
    {
      label: session,
      isActive: true,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
for (const type of types) {
  const slug = slugify(type);
  if (!slug) throw new Error(`Invalid certificate type: ${type}`);
  await db.collection("certificateTypes").doc(slug).set(
    {
      name: type,
      slug,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}
process.stdout.write(
  `Seeded ${sessions.length} session(s) and ${types.length} certificate type(s).\n`,
);
