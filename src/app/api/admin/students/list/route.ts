import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/firebase-admin";
import { apiError, requireRoles } from "@/server/security";
import { decryptStudentIdentifier } from "@/server/student-pii";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["uploader", "approver"]);
    const snapshot = await db
      .collection("students")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    const students = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const certs = await db
          .collection("certificates")
          .where("studentId", "==", doc.id)
          .get();
        let admissionNo = String(doc.get("admissionNo") ?? "");
        let dateOfBirth = "";
        const encryptedAdmission = doc.get("admissionNumber");
        const encryptedDob = doc.get("dateOfBirth");
        if (typeof encryptedAdmission === "string") {
          try {
            admissionNo = decryptStudentIdentifier(encryptedAdmission);
          } catch {
            admissionNo = "[encrypted]";
          }
        }
        if (typeof encryptedDob === "string") {
          try {
            dateOfBirth = decryptStudentIdentifier(encryptedDob);
          } catch {
            dateOfBirth = "";
          }
        }
        return {
          id: doc.id,
          admissionNo,
          dateOfBirth,
          studentName: doc.get("studentName"),
          fatherName: doc.get("fatherName"),
          motherName: doc.get("motherName"),
          session: doc.get("session"),
          certificateCount: certs.size,
        };
      }),
    );
    return NextResponse.json(
      { students, hasMore: snapshot.size === 100 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
