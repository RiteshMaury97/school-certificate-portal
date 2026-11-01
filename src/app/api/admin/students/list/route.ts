import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { apiError, requireRoles } from "@/server/security";
import { decryptStudentIdentifier } from "@/server/student-pii";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["uploader", "approver", "admin"]);
    const collection = db.collection("students");
    const cursorId = request.nextUrl.searchParams.get("cursor");
    let query = collection.orderBy("createdAt", "desc").limit(100);
    if (cursorId) {
      const cursor = await collection.doc(cursorId).get();
      if (!cursor.exists)
        return NextResponse.json({ error: "Invalid student cursor." }, { status: 400 });
      query = query.startAfter(cursor);
    }
    const snapshot = await query.get();
    const students = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const certs = await db.collection("certificates").where("studentId", "==", doc.id).get();
        let admissionNo = String(doc.get("admissionNo") ?? "");
        let dateOfBirth = "";
        let scholarNumber = "";
        const encryptedAdmission = doc.get("admissionNumber");
        const encryptedDob = doc.get("dateOfBirth");
        const encryptedScholarNumber = doc.get("scholarNumber");
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
        if (typeof encryptedScholarNumber === "string") {
          try {
            scholarNumber = decryptStudentIdentifier(encryptedScholarNumber);
          } catch {
            scholarNumber = "";
          }
        }
        return {
          id: doc.id,
          admissionNo,
          dateOfBirth,
          parentEmail: String(doc.get("parentEmail") ?? ""),
          parentMobile: String(doc.get("parentMobile") ?? ""),
          notificationConsent:
            doc.get("notificationConsent") === true && doc.get("notificationOptOut") !== true,
          scholarNumber,
          className: String(doc.get("className") ?? ""),
          studentName: doc.get("studentName"),
          fatherName: doc.get("fatherName"),
          motherName: doc.get("motherName"),
          session: doc.get("session"),
          certificateCount: certs.size,
        };
      }),
    );
    return NextResponse.json(
      {
        students,
        hasMore: snapshot.size === 100,
        nextCursor: snapshot.size === 100 ? (snapshot.docs.at(-1)?.id ?? null) : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
