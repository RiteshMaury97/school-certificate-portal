import "server-only";
import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/server/firebase-admin";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Keep the public session picker backed by one compact document. */
export async function adjustPublicSessions(
  changes: { session: string; delta: 1 | -1 }[],
): Promise<void> {
  const ref = db.collection("publicSessions").doc("main");
  if (!(await ref.get()).exists) {
    // Bootstrap outside a transaction: the full published set can be larger
    // than a Firestore transaction should read. Callers ensure the index before
    // applying a normal publish/revoke transition.
    await rebuildPublicSessions();
    return;
  }
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    const rawCounts: unknown = snapshot.get("counts");
    const counts = isRecord(rawCounts) ? { ...rawCounts } : {};
    for (const change of changes) {
      if (!/^\d{4}-\d{2}$/.test(change.session)) continue;
      const currentCount = Number(counts[change.session] ?? 0);
      counts[change.session] = Math.max(0, currentCount + change.delta);
    }
    const clean = Object.fromEntries(
      Object.entries(counts)
        .filter(([, count]) => Number(count) > 0)
        .map(([session, count]) => [session, Number(count)]),
    );
    tx.set(ref, {
      sessions: Object.keys(clean).sort((a, b) => b.localeCompare(a)),
      counts: clean,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

/** Rebuild the small index after bulk removal/erasure. */
export async function rebuildPublicSessions(): Promise<void> {
  const published = await db.collection("certificates").where("status", "==", "published").get();
  const counts: Record<string, number> = {};
  for (const doc of published.docs) {
    const session = String(doc.get("session") ?? "");
    if (
      /^\d{4}-\d{2}$/.test(session) &&
      doc.get("published") !== false &&
      doc.get("erasurePending") !== true
    )
      counts[session] = (counts[session] ?? 0) + 1;
  }
  await db
    .collection("publicSessions")
    .doc("main")
    .set({
      sessions: Object.keys(counts).sort((a, b) => b.localeCompare(a)),
      counts,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function ensurePublicSessions(): Promise<void> {
  const snapshot = await db.collection("publicSessions").doc("main").get();
  if (!snapshot.exists) await rebuildPublicSessions();
}
