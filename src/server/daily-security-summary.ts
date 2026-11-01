import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/server/firebase-admin";

export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export async function incrementDailySecurityMetric(
  metric: "failedSignIns" | "lockouts" | "blockedLocations" | "uploads",
): Promise<void> {
  const ref = db.collection("abuseCounters").doc(`security_summary_${utcDayKey()}`);
  await ref.set(
    { [metric]: FieldValue.increment(1), date: utcDayKey(), updatedAt: new Date() },
    { merge: true },
  );
}
