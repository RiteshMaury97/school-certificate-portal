import { randomUUID } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import {
  apiError,
  createSearchKey,
  requireRoles,
  sameOrigin,
  writeAuditLog,
} from "@/server/security";
import {
  encryptStudentIdentifier,
  scholarLookupHmac,
  studentIdentifierHmac,
} from "@/server/student-pii";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { studentProfileCreateSchema } from "@/shared/validation";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["uploader", "admin"]);
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const raw: unknown = await request.json().catch(() => null);
    if (typeof raw !== "object" || raw === null)
      return NextResponse.json({ error: "Invalid student details." }, { status: 400 });
    const body = raw as Record<string, unknown>;
    const parsed = studentProfileCreateSchema.safeParse({
      ...body,
      session: normalizeAcademicSession(String(body.session ?? "")) ?? String(body.session ?? ""),
    });
    if (!parsed.success)
      return NextResponse.json(
        { error: "Check the student details and try again." },
        { status: 400 },
      );
    const data = parsed.data;
    const parentEmail =
      typeof body.parentEmail === "string" ? body.parentEmail.trim().toLowerCase() : "";
    const parentMobile = typeof body.parentMobile === "string" ? body.parentMobile.trim() : "";
    const notificationConsent = body.notificationConsent === true;
    if ((parentEmail || parentMobile) && !notificationConsent)
      return NextResponse.json(
        { error: "Parent contact details require explicit notification consent." },
        { status: 400 },
      );
    if (
      (notificationConsent && !parentEmail && !parentMobile) ||
      (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) ||
      (parentMobile && !/^\+?[0-9]{10,15}$/.test(parentMobile))
    )
      return NextResponse.json(
        { error: "Provide a valid parent contact and consent." },
        { status: 400 },
      );

    const searchKey = createSearchKey(data);
    const scholarLookupKey = scholarLookupHmac(data.scholarNumber, data.className, data.session);
    const [scholarMatches, duplicateMatches] = await Promise.all([
      db.collection("students").where("scholarLookupKey", "==", scholarLookupKey).get(),
      db.collection("students").where("searchKey", "==", searchKey).get(),
    ]);
    if (!scholarMatches.empty || !duplicateMatches.empty)
      return NextResponse.json(
        {
          error:
            "A student with this scholar number, class, and session already exists. Edit the existing student record instead.",
        },
        { status: 409 },
      );

    const now = FieldValue.serverTimestamp();
    const studentId = randomUUID();
    const admissionNumber = data.admissionNumber || data.admissionNo || "";
    const dateOfBirth = data.dateOfBirth || "";
    await db
      .collection("students")
      .doc(studentId)
      .create({
        studentName: data.studentName,
        fatherName: data.fatherName,
        motherName: data.motherName,
        className: data.className,
        scholarNumber: encryptStudentIdentifier(data.scholarNumber),
        scholarLookupKey,
        session: data.session,
        searchKey,
        ...(admissionNumber
          ? {
              admissionNumber: encryptStudentIdentifier(admissionNumber),
              admissionNumberDisambiguationKey: studentIdentifierHmac(admissionNumber),
            }
          : {}),
        ...(dateOfBirth
          ? {
              dateOfBirth: encryptStudentIdentifier(dateOfBirth),
              dateOfBirthDisambiguationKey: studentIdentifierHmac(dateOfBirth),
            }
          : {}),
        ...(notificationConsent
          ? {
              parentEmail,
              parentMobile,
              notificationConsent: true,
              notificationConsentAt: now,
              notificationConsentPurpose: "certificate_availability",
            }
          : {}),
        createdAt: now,
        updatedAt: now,
        createdBy: admin.uid,
        updatedBy: admin.uid,
      });
    await writeAuditLog(request, admin.uid, "student.create", studentId, studentId);
    return NextResponse.json(
      { ok: true, studentId },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
