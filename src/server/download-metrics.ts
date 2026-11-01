import "server-only";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";

import { db } from "@/server/firebase-admin";

export async function recordCertificateDownloads(
  items: { ref: DocumentReference; session: string }[],
): Promise<void> {
  if (!items.length) return;
  await db.runTransaction((tx) => {
    const bySession = new Map<string, number>();
    for (const item of items) {
      tx.update(item.ref, {
        downloadCount: FieldValue.increment(1),
        lastDownloadedAt: FieldValue.serverTimestamp(),
      });
      bySession.set(item.session, (bySession.get(item.session) ?? 0) + 1);
    }
    for (const [session, count] of bySession) {
      tx.set(
        db.collection("certificateDownloadSessions").doc(session),
        {
          session,
          totalDownloads: FieldValue.increment(count),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    return Promise.resolve();
  });
}
