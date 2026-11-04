import { db } from "@/server/firebase-admin";
import { studentAccessTokenOwnsStudent } from "@/server/security";
import type { verifyStudentAccessToken } from "@/server/security";

import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

export async function findAuthorizedCertificates(
  ids: string[],
  claims: NonNullable<ReturnType<typeof verifyStudentAccessToken>>,
): Promise<QueryDocumentSnapshot[]> {
  const docs: QueryDocumentSnapshot[] = [];
  const studentStates = new Map<string, boolean>();
  for (const id of ids) {
    const found = await db.collection("certificates").where("publicId", "==", id).limit(1).get();
    const doc = found.docs.at(0);
    if (!doc) continue;
    const data = doc.data();
    const studentId = String(data.studentId ?? "");
    if (!studentId || !studentAccessTokenOwnsStudent(claims, studentId)) continue;
    let visible = studentStates.get(studentId);
    if (visible === undefined) {
      const student = await db.collection("students").doc(studentId).get();
      visible = student.exists && student.get("erasurePending") !== true;
      studentStates.set(studentId, visible);
    }
    if (data.status === "published" && data.published !== false && visible) docs.push(doc);
  }
  return docs;
}
