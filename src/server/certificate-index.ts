import "server-only";
import { db } from "@/server/firebase-admin";
import { createCertificateNumberHash } from "@/server/security";

export class DuplicateCertificateNumberError extends Error {
  constructor() { super("DUPLICATE_CERTIFICATE_NUMBER"); }
}

export async function createCertificateNumberIndex(
  certificateNumber: string, certificateId: string, session: string
): Promise<string> {
  const hash = createCertificateNumberHash(certificateNumber);
  const indexRef = db.collection("certificateNumberIndex").doc(hash);
  await db.runTransaction(async transaction => {
    const existing = await transaction.get(indexRef);
    if (existing.exists) throw new DuplicateCertificateNumberError();
    transaction.create(indexRef, {
      certificateId, session, createdAt: new Date()
    });
  });
  return hash;
}

export async function replaceCertificateNumberIndex(
  certificateNumber: string, certificateId: string, session: string
): Promise<void> {
  const hash = createCertificateNumberHash(certificateNumber);
  const indexRef = db.collection("certificateNumberIndex").doc(hash);
  const oldQuery = await db.collection("certificateNumberIndex")
    .where("certificateId", "==", certificateId).limit(2).get();
  await db.runTransaction(async transaction => {
    const next = await transaction.get(indexRef);
    if (next.exists && next.get("certificateId") !== certificateId) {
      throw new DuplicateCertificateNumberError();
    }
    for (const old of oldQuery.docs) {
      if (old.id !== hash) transaction.delete(old.ref);
    }
    if (!next.exists) transaction.create(indexRef, { certificateId, session, createdAt: new Date() });
    else transaction.update(indexRef, { session, updatedAt: new Date() });
  });
}

export async function removeCertificateNumberIndex(certificateId: string): Promise<void> {
  const matches = await db.collection("certificateNumberIndex")
    .where("certificateId", "==", certificateId).limit(10).get();
  if (matches.empty) return;
  const batch = db.batch();
  for (const document of matches.docs) batch.delete(document.ref);
  await batch.commit();
}
