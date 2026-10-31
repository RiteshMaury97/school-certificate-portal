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
const [students, certificates] = await Promise.all([
  db.collection("students").count().get(),
  db.collection("certificates").count().get(),
]);
await db
  .collection("metricsCounters")
  .doc("portal")
  .set(
    {
      totalStudents: students.data().count,
      totalCertificates: certificates.data().count,
      updatedAt: FieldValue.serverTimestamp(),
      backfilledAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
console.log(
  `Metrics initialized: ${students.data().count} students, ${certificates.data().count} certificates.`,
);
await app.delete();
