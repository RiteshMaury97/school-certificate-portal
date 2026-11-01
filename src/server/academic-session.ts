import { db } from "@/server/firebase-admin";
import { normalizeAcademicSession } from "@/shared/academic-session";

export async function findAcademicSessionDocument(session: string) {
  const sessions = db.collection("sessions");
  const direct = await sessions.doc(session).get();
  if (direct.exists) return direct;

  const normalized = normalizeAcademicSession(session);
  if (!normalized) return direct;

  const snapshot = await sessions.get();
  return (
    snapshot.docs.find((doc) =>
      [doc.id, doc.get("label"), doc.get("name")].some(
        (value) => typeof value === "string" && normalizeAcademicSession(value) === normalized,
      ),
    ) ?? direct
  );
}
