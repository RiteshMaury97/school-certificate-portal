import "server-only";

import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/server/firebase-admin";

export type DailySecurityMetric = "failedSignIns" | "lockouts";

export async function recordDailySecurityMetric(metric: DailySecurityMetric): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.collection("abuseCounters").doc(`security_summary_${day}`);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    transaction.set(
      ref,
      {
        day,
        [metric]: Number(snapshot.get(metric) ?? 0) + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}
