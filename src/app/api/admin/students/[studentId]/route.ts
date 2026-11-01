import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { removeCertificateNumberIndex } from "@/server/certificate-index";
import { db } from "@/server/firebase-admin";
import {
  ensurePublicSessions,
  rebuildPublicSessions,
} from "@/server/public-sessions";
import { softDeleteR2Object } from "@/server/r2";
import {
  createSearchKey,
  requireRoles,
  requireSensitiveReauth,
  writeAuditLog,
  apiError,
} from "@/server/security";
import {
  encryptStudentIdentifier,
  scholarLookupHmac,
  studentIdentifierHmac,
  studentIdentityMatches,
} from "@/server/student-pii";
import { retentionExpiryFromSession } from "@/shared/retention-policy";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { studentUpdateSchema } from "@/shared/validation";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const admin = await requireRoles(request, ["uploader", "admin"]);
    const { studentId } = await context.params;
    const parsed = studentUpdateSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid student details." },
        { status: 400 },
      );
    const data = parsed.data;
    const ref = db.collection("students").doc(studentId);
    const snapshot = await ref.get();
    if (!snapshot.exists)
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 },
      );
    const currentSession = normalizeAcademicSession(
      String(snapshot.get("session") ?? ""),
    );
    const linkedCertificates = await db
      .collection("certificates")
      .where("studentId", "==", studentId)
      .get();
    const requestedSession = normalizeAcademicSession(data.session);
    if (
      linkedCertificates.size > 0 &&
      requestedSession !== currentSession &&
      linkedCertificates.docs.some(
        (certificate) =>
          normalizeAcademicSession(String(certificate.get("session") ?? "")) !==
          requestedSession,
      )
    )
      return NextResponse.json(
        {
          error:
            "This student has linked certificates in another session. Update the certificates to the same session before changing the student session.",
        },
        { status: 409 },
      );
    const searchKey = createSearchKey(data);
    const scholarLookupKey = scholarLookupHmac(
      data.scholarNumber,
      data.className,
      data.session,
    );
    const scholarMatches = await db
      .collection("students")
      .where("scholarLookupKey", "==", scholarLookupKey)
      .get();
    if (scholarMatches.docs.some((document) => document.id !== studentId))
      return NextResponse.json(
        { error: "That scholar number is already assigned in this class and session." },
        { status: 409 },
      );
    const duplicates = await db
      .collection("students")
      .where("searchKey", "==", searchKey)
      .get();
    const dateOfBirth = data.dateOfBirth || "";
    const legacyAdmissionNumber = String(snapshot.get("admissionNo") ?? "");
    const admissionNumber = data.admissionNumber || legacyAdmissionNumber;
    const dateOfBirthDisambiguationKey = dateOfBirth
      ? studentIdentifierHmac(dateOfBirth)
      : "";
    const admissionNumberDisambiguationKey = admissionNumber
      ? studentIdentifierHmac(admissionNumber)
      : "";
    const otherDuplicates = duplicates.docs.filter(
      (doc) => doc.id !== studentId,
    );
    if (
      otherDuplicates.length &&
      !dateOfBirthDisambiguationKey &&
      !admissionNumberDisambiguationKey
    )
      return NextResponse.json(
        {
          error:
            "Duplicate name combination detected: add a date of birth or admission number so students can be told apart.",
        },
        { status: 409 },
      );
    if (
      otherDuplicates.some((doc) =>
        studentIdentityMatches(
          doc.data(),
          dateOfBirthDisambiguationKey,
          admissionNumberDisambiguationKey,
        ),
      )
    )
      return NextResponse.json(
        {
          error:
            "The supplied date of birth or admission number is already assigned to another matching student.",
        },
        { status: 409 },
      );
    const settings = await db.collection("siteSettings").doc("main").get();
    const retentionYears = Math.max(
      1,
      Math.min(30, Number(settings.get("retentionYears") ?? 7)),
    );
    const retentionExpiresAt = retentionExpiryFromSession(
      data.session,
      retentionYears,
    );
    if (!retentionExpiresAt)
      return NextResponse.json(
        { error: "Invalid academic session for retention calculation." },
        { status: 400 },
      );
    const update: Record<string, unknown> = {
      studentName: data.studentName,
      fatherName: data.fatherName,
      motherName: data.motherName,
      className: data.className,
      scholarNumber: encryptStudentIdentifier(data.scholarNumber),
      scholarLookupKey,
      session: data.session,
      searchKey,
      retentionExpiresAt,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
      ...(admissionNumber ? { admissionNo: FieldValue.delete() } : {}),
    };
    if (dateOfBirth) {
      update.dateOfBirth = encryptStudentIdentifier(dateOfBirth);
      update.dateOfBirthDisambiguationKey = dateOfBirthDisambiguationKey;
    }
    if (admissionNumber) {
      update.admissionNumber = encryptStudentIdentifier(admissionNumber);
      update.admissionNumberDisambiguationKey =
        admissionNumberDisambiguationKey;
      update.admissionNo = FieldValue.delete();
    }
    await ref.update(update);
    await writeAuditLog(
      request,
      admin.uid,
      "student.update",
      studentId,
      studentId,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> },
) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    await requireSensitiveReauth(request, admin);
    const { studentId } = await context.params;
    const ref = db.collection("students").doc(studentId);
    const student = await ref.get();
    if (!student.exists)
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 },
      );
    const certs = await db
      .collection("certificates")
      .where("studentId", "==", studentId)
      .get();
    if (certs.docs.some((cert) => cert.get("status") === "published"))
      await ensurePublicSessions();
    for (const cert of certs.docs) {
      const r2Key = String(cert.get("r2Key") ?? "");
      if (r2Key) await softDeleteR2Object(r2Key, studentId);
      await removeCertificateNumberIndex(cert.id);
    }
    const batch = db.batch();
    for (const doc of certs.docs) batch.delete(doc.ref);
    batch.delete(ref);
    await batch.commit();
    if (certs.size > 0)
      await db
        .collection("metricsCounters")
        .doc("portal")
        .set(
          { totalCertificates: FieldValue.increment(-certs.size) },
          { merge: true },
        );
    if (certs.docs.some((cert) => cert.get("status") === "published"))
      await rebuildPublicSessions();
    await writeAuditLog(
      request,
      admin.uid,
      "student.delete",
      studentId,
      studentId,
    );
    return NextResponse.json({ ok: true, deletedCertificates: certs.size });
  } catch (error) {
    return apiError(error);
  }
}
