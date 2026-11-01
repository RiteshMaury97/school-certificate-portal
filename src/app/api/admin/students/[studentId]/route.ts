import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { removeCertificateNumberIndex } from "@/server/certificate-index";
import { db } from "@/server/firebase-admin";
import { ensurePublicSessions, rebuildPublicSessions } from "@/server/public-sessions";
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
  decryptStudentIdentifier,
  scholarLookupHmac,
  studentIdentifierHmac,
  studentIdentityMatches,
} from "@/server/student-pii";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { studentUpdateSchema } from "@/shared/validation";

import type { NextRequest } from "next/server";
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
      return NextResponse.json({ error: "Invalid student details." }, { status: 400 });
    const data = parsed.data;
    const parentEmail = data.parentEmail.trim().toLowerCase();
    const parentMobile = data.parentMobile.trim();
    if (data.notificationConsent && !parentEmail && !parentMobile)
      return NextResponse.json(
        {
          error:
            "A parent email or mobile number is required when notification consent is enabled.",
        },
        { status: 400 },
      );
    const ref = db.collection("students").doc(studentId);
    const snapshot = await ref.get();
    if (!snapshot.exists)
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    const currentSession = normalizeAcademicSession(String(snapshot.get("session") ?? ""));
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
          normalizeAcademicSession(String(certificate.get("session") ?? "")) !== requestedSession,
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
    const scholarLookupKey = scholarLookupHmac(data.scholarNumber, data.className, data.session);
    const scholarMatches = await db
      .collection("students")
      .where("scholarLookupKey", "==", scholarLookupKey)
      .get();
    if (scholarMatches.docs.some((document) => document.id !== studentId))
      return NextResponse.json(
        { error: "That scholar number is already assigned in this class and session." },
        { status: 409 },
      );
    const duplicates = await db.collection("students").where("searchKey", "==", searchKey).get();
    const dateOfBirth = data.dateOfBirth || "";
    const admissionNumber = data.admissionNumber || "";
    const dateOfBirthDisambiguationKey = dateOfBirth ? studentIdentifierHmac(dateOfBirth) : "";
    const admissionNumberDisambiguationKey = admissionNumber
      ? studentIdentifierHmac(admissionNumber)
      : "";
    const otherDuplicates = duplicates.docs.filter((doc) => doc.id !== studentId);
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
    const update: Record<string, unknown> = {
      studentName: data.studentName,
      fatherName: data.fatherName,
      motherName: data.motherName,
      className: data.className,
      scholarNumber: encryptStudentIdentifier(data.scholarNumber),
      scholarLookupKey,
      session: data.session,
      parentEmail,
      parentMobile,
      notificationConsent: data.notificationConsent,
      notificationOptOut: !data.notificationConsent,
      searchKey,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
      ...(admissionNumber ? { admissionNo: FieldValue.delete() } : {}),
      admissionNumber: FieldValue.delete(),
      admissionNumberDisambiguationKey: FieldValue.delete(),
      dateOfBirth: FieldValue.delete(),
      dateOfBirthDisambiguationKey: FieldValue.delete(),
    };
    const notificationConsentWasActive =
      snapshot.get("notificationConsent") === true && snapshot.get("notificationOptOut") !== true;
    const notificationContactChanged =
      String(snapshot.get("parentEmail") ?? "") !== parentEmail ||
      String(snapshot.get("parentMobile") ?? "") !== parentMobile;
    if (data.notificationConsent) {
      if (!notificationConsentWasActive || notificationContactChanged)
        update.notificationConsentAt = FieldValue.serverTimestamp();
      update.notificationConsentPurpose = "certificate_availability";
    } else {
      update.notificationConsentAt = FieldValue.delete();
      update.notificationConsentPurpose = FieldValue.delete();
    }
    if (dateOfBirth) {
      update.dateOfBirth = encryptStudentIdentifier(dateOfBirth);
      update.dateOfBirthDisambiguationKey = dateOfBirthDisambiguationKey;
    }
    if (admissionNumber) {
      update.admissionNumber = encryptStudentIdentifier(admissionNumber);
      update.admissionNumberDisambiguationKey = admissionNumberDisambiguationKey;
      update.admissionNo = FieldValue.delete();
    }
    const currentAdmission = (() => {
      const encrypted = snapshot.get("admissionNumber");
      if (typeof encrypted !== "string") return String(snapshot.get("admissionNo") ?? "");
      try {
        return decryptStudentIdentifier(encrypted);
      } catch {
        return "";
      }
    })();
    const currentDateOfBirth = (() => {
      const encrypted = snapshot.get("dateOfBirth");
      if (typeof encrypted !== "string") return "";
      try {
        return decryptStudentIdentifier(encrypted);
      } catch {
        return "";
      }
    })();
    const currentScholarNumber = (() => {
      const encrypted = snapshot.get("scholarNumber");
      if (typeof encrypted !== "string") return "";
      try {
        return decryptStudentIdentifier(encrypted);
      } catch {
        return "";
      }
    })();
    const compareValues: Record<string, [string, string]> = {
      "Student name": [String(snapshot.get("studentName") ?? ""), data.studentName],
      "Father name": [String(snapshot.get("fatherName") ?? ""), data.fatherName],
      "Mother name": [String(snapshot.get("motherName") ?? ""), data.motherName],
      "Class / section": [String(snapshot.get("className") ?? ""), data.className],
      "Scholar number": [currentScholarNumber, data.scholarNumber],
      "Academic session": [String(snapshot.get("session") ?? ""), data.session],
      "Admission number": [currentAdmission, data.admissionNumber || ""],
      "Date of birth": [currentDateOfBirth, data.dateOfBirth || ""],
      "Parent email": [String(snapshot.get("parentEmail") ?? ""), parentEmail],
      "Parent mobile": [String(snapshot.get("parentMobile") ?? ""), parentMobile],
      "Notification consent": [
        String(
          snapshot.get("notificationConsent") === true &&
            snapshot.get("notificationOptOut") !== true,
        ),
        String(data.notificationConsent),
      ],
    };
    const changedFields = Object.entries(compareValues)
      .filter(([, [before, after]]) => before.trim() !== after.trim())
      .map(([field]) => field);
    await ref.update(update);
    await writeAuditLog(request, admin.uid, "student.update", studentId, studentId, {
      changedFields,
    });
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
    if (!student.exists) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    const certs = await db.collection("certificates").where("studentId", "==", studentId).get();
    if (certs.docs.some((cert) => cert.get("status") === "published")) await ensurePublicSessions();
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
        .set({ totalCertificates: FieldValue.increment(-certs.size) }, { merge: true });
    if (certs.docs.some((cert) => cert.get("status") === "published"))
      await rebuildPublicSessions();
    await writeAuditLog(request, admin.uid, "student.delete", studentId, studentId);
    return NextResponse.json({ ok: true, deletedCertificates: certs.size });
  } catch (error) {
    return apiError(error);
  }
}
