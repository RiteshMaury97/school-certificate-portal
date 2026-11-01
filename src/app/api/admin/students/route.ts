
import { randomUUID, createHash } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { formString } from "@/app/api/_lib/form-data";
import { findAcademicSessionDocument } from "@/server/academic-session";
import { publishCertificateWithoutReview } from "@/server/certificate-auto-publish";
import {
  createCertificateNumberIndex,
  DuplicateCertificateNumberError,
  removeCertificateNumberIndex,
} from "@/server/certificate-index";
import { encryptCertificateNumber } from "@/server/certificate-number";
import { db } from "@/server/firebase-admin";
import { uploadCertificate, softDeleteR2Object } from "@/server/r2";
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
  studentIdentityMatches,
} from "@/server/student-pii";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { duplicateFileDecision } from "@/shared/certificate-lifecycle";
import { normalize, studentCreateSchema } from "@/shared/validation";

import type { NextRequest} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["uploader", "admin", "superadmin"]);
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 6 * 1024 * 1024)
      return NextResponse.json(
        { error: "Upload exceeds the 5 MB file limit." },
        { status: 413 },
      );
    const form = await request.formData();
    const payload = {
      admissionNo: formString(form, "admissionNo").trim(),
      admissionNumber: String(
        form.get("admissionNumber") ?? form.get("admissionNo") ?? "",
      ).trim(),
      dateOfBirth: formString(form, "dateOfBirth").trim(),
      studentName: formString(form, "studentName"),
      fatherName: formString(form, "fatherName"),
      motherName: formString(form, "motherName"),
      className: formString(form, "className"),
      scholarNumber: formString(form, "scholarNumber"),
      session: normalizeAcademicSession(formString(form, "session")) ?? formString(form, "session"),
      certificateType: formString(form, "certificateType"),
      certificateNumber: formString(form, "certificateNumber"),
      issuedAt: formString(form, "issuedAt"),
    };
    const parsed = studentCreateSchema.safeParse(payload);
    const file = form.get("file");
    if (!parsed.success || !(file instanceof File)) {
      const labels: Record<string, string> = {
        studentName: "Student name",
        fatherName: "Father name",
        motherName: "Mother name",
        className: "Class / section",
        scholarNumber: "Scholar number",
        session: "Academic session",
        certificateType: "Certificate type",
        certificateNumber: "Certificate number",
        issuedAt: "Issue date",
        dateOfBirth: "Date of birth",
      };
      const problems = parsed.success
        ? []
        : parsed.error.issues.map((issue) => {
            const field = String(issue.path[0] ?? "Form");
            return `${labels[field] ?? field}: ${issue.message}`;
          });
      if (!(file instanceof File)) problems.push("Certificate file: select a valid PDF, JPG or PNG.");
      return NextResponse.json(
        {
          error: problems.length
            ? `Please correct the following: ${problems.join("; ")}`
            : "Complete every required field and attach a valid certificate.",
        },
        { status: 400 },
      );
    }
    const data = parsed.data;
    const parentEmail = formString(form, "parentEmail")
      .trim()
      .toLowerCase();
    const parentMobile = formString(form, "parentMobile").trim();
    const notificationConsent =
      formString(form, "notificationConsent") === "true";
    if (
      (notificationConsent && !parentEmail && !parentMobile) ||
      ((parentEmail || parentMobile) &&
        (!notificationConsent ||
          (parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) ||
          (parentMobile && !/^\+?[0-9]{10,15}$/.test(parentMobile))))
    )
      return NextResponse.json(
        {
          error:
            "A valid parent contact and explicit notification consent are required.",
        },
        { status: 400 },
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
    if (
      scholarMatches.docs.some((document) => document.get("searchKey") !== searchKey)
    )
      return NextResponse.json(
        { error: "That scholar number is already assigned in this class and session." },
        { status: 409 },
      );
    const matching = await db
      .collection("students")
      .where("searchKey", "==", searchKey)
      .get();
    const dateOfBirth = data.dateOfBirth || "";
    const admissionNumber = data.admissionNumber || "";
    const dateOfBirthDisambiguationKey = dateOfBirth
      ? studentIdentifierHmac(dateOfBirth)
      : "";
    const admissionNumberDisambiguationKey = admissionNumber
      ? studentIdentifierHmac(admissionNumber)
      : "";
    const duplicateCombination = !matching.empty;
    const existingDuplicateNeedsIdentity = matching.docs.some(
      (doc) =>
        !doc.get("dateOfBirthDisambiguationKey") &&
        !doc.get("admissionNumberDisambiguationKey"),
    );
    if (
      duplicateCombination &&
      ((!dateOfBirthDisambiguationKey && !admissionNumberDisambiguationKey) ||
        existingDuplicateNeedsIdentity)
    ) {
      return NextResponse.json(
        {
          error:
            "Duplicate name combination detected: add a date of birth or admission number so students can be told apart.",
        },
        { status: 409 },
      );
    }
    const identifiedMatches = matching.docs.filter((doc) =>
      studentIdentityMatches(
        doc.data(),
        dateOfBirthDisambiguationKey,
        admissionNumberDisambiguationKey,
      ),
    );
    if (identifiedMatches.length > 1)
      return NextResponse.json(
        {
          error:
            "The supplied identity details match multiple student records. Review the existing records before continuing.",
        },
        { status: 409 },
      );
    const reuseExisting = identifiedMatches.length === 1;
    const studentRef = reuseExisting
      ? (identifiedMatches[0] ?? matching.docs[0]!).ref
      : db.collection("students").doc(randomUUID());
    const typeSlug = slugify(data.certificateType);
    if (!typeSlug)
      return NextResponse.json(
        { error: "Invalid certificate type." },
        { status: 400 },
      );
    const sessionDoc = await findAcademicSessionDocument(data.session);
    const typeDoc = await db.collection("certificateTypes").doc(typeSlug).get();
    if (
      !sessionDoc.exists ||
      sessionDoc.get("isActive") === false ||
      !typeDoc.exists
    ) {
      return NextResponse.json(
        { error: "Select an active session and configured certificate type." },
        { status: 400 },
      );
    }
    const fileHash = createHash("sha256")
      .update(Buffer.from(await file.arrayBuffer()))
      .digest("hex");
    const sameHash = await db
      .collection("certificates")
      .where("sha256", "==", fileHash)
      .get();
    const duplicateDecision = duplicateFileDecision(
      sameHash.docs.map((doc) => ({
        studentId: doc.get("studentId"),
        type: doc.get("type"),
      })),
      studentRef.id,
      data.certificateType,
    );
    if (duplicateDecision === "block-same-student-type")
      return NextResponse.json(
        {
          error:
            "An identical file already exists for this student and certificate type.",
        },
        { status: 409 },
      );
    const duplicateHashConfirmed =
      formString(form, "confirmDuplicateHash") === "true";
    const duplicateHashReason = String(
      form.get("duplicateHashReason") ?? "",
    ).trim();
    if (
      duplicateDecision === "warn-cross-record" &&
      (!duplicateHashConfirmed || duplicateHashReason.length < 10)
    )
      return NextResponse.json(
        {
          error:
            "This file matches an existing certificate for a different record. Confirm this is intentional and provide a reason.",
          duplicateFileWarning: true,
        },
        { status: 409 },
      );
    const certificateNumberEncrypted = encryptCertificateNumber(
      data.certificateNumber,
    );
    const stored = await uploadCertificate(
      file,
      data.session,
      data.certificateType,
      studentRef.id,
    );
    const now = FieldValue.serverTimestamp();
    try {
      if (!reuseExisting) {
        await studentRef.set({
          studentName: data.studentName,
          fatherName: data.fatherName,
          motherName: data.motherName,
          className: data.className,
          scholarNumber: encryptStudentIdentifier(data.scholarNumber),
          scholarLookupKey,
          session: data.session,
          searchKey,
          createdAt: now,
          updatedAt: now,
          createdBy: admin.uid,
          ...(dateOfBirth
            ? {
                dateOfBirth: encryptStudentIdentifier(dateOfBirth),
                dateOfBirthDisambiguationKey,
              }
            : {}),
          ...(admissionNumber
            ? {
                admissionNumber: encryptStudentIdentifier(admissionNumber),
                admissionNumberDisambiguationKey,
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
        });
      } else {
        await studentRef.update({
          studentName: data.studentName,
          fatherName: data.fatherName,
          motherName: data.motherName,
          className: data.className,
          scholarNumber: encryptStudentIdentifier(data.scholarNumber),
          scholarLookupKey,
          ...(admissionNumber ? { admissionNo: FieldValue.delete() } : {}),
          updatedAt: now,
          ...(dateOfBirth
            ? {
                dateOfBirth: encryptStudentIdentifier(dateOfBirth),
                dateOfBirthDisambiguationKey,
              }
            : {}),
          ...(admissionNumber
            ? {
                admissionNumber: encryptStudentIdentifier(admissionNumber),
                admissionNumberDisambiguationKey,
              }
            : {}),
          ...(notificationConsent
            ? {
                parentEmail,
                parentMobile,
                notificationConsent: true,
                notificationConsentAt: now,
                notificationConsentPurpose: "certificate_availability",
                notificationOptOut: false,
              }
            : {}),
        });
      }
      const certificateRef = db.collection("certificates").doc(randomUUID());
      try {
        await createCertificateNumberIndex(
          data.certificateNumber,
          certificateRef.id,
          data.session,
        );
        await certificateRef.set({
          publicId: randomUUID().replace(/-/g, ""),
          studentId: studentRef.id,
          session: data.session,
          type: data.certificateType,
          certificateNumberEncrypted,
          r2Key: stored.r2Key,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          size: stored.size,
          sha256: stored.sha256,
          issueDate: data.issuedAt,
          status: "pending",
          published: false,
          uploadedBy: admin.uid,
          createdAt: now,
          ...(sameHash.empty
            ? {}
            : {
                duplicateFileConfirmed: true,
                duplicateFileReason: duplicateHashReason,
                duplicateFileMatches: sameHash.docs.map((doc) => doc.id),
              }),
        });
      } catch (error) {
        await removeCertificateNumberIndex(certificateRef.id).catch(() => { console.error("Certificate index cleanup failed"); },
        );
        await softDeleteR2Object(stored.r2Key, studentRef.id).catch(() => { console.error("Orphan R2 cleanup failed"); },
        );
        if (error instanceof DuplicateCertificateNumberError) {
          if (!reuseExisting)
            await studentRef
              .delete()
              .catch(() => { console.error("Empty student record cleanup failed"); },
              );
          return NextResponse.json(
            { error: "That certificate number is already assigned." },
            { status: 409 },
          );
        }
        throw error;
      }
      if (admin.role === "admin" || admin.role === "superadmin") {
        await publishCertificateWithoutReview(certificateRef.id, admin.uid);
        await writeAuditLog(
          request,
          admin.uid,
          "certificate.auto_published",
          certificateRef.id,
          studentRef.id,
        );
      }
      await writeAuditLog(
        request,
        admin.uid,
        "certificate.upload",
        certificateRef.id,
        studentRef.id,
      );
      if (!sameHash.empty)
        await writeAuditLog(
          request,
          admin.uid,
          "certificate.duplicate_hash_override",
          certificateRef.id,
          studentRef.id,
        );
      if (!reuseExisting)
        await writeAuditLog(
          request,
          admin.uid,
          "student.create",
          studentRef.id,
          studentRef.id,
        );
      if (notificationConsent)
        await db
          .collection("notificationConsents")
          .add({
            studentId: studentRef.id,
            consentGiven: true,
            purpose: "certificate_availability",
            contactChannels: [
              parentEmail ? "email" : "",
              parentMobile ? "sms" : "",
            ].filter(Boolean),
            timestamp: now,
            collectedBy: admin.uid,
          });
    } catch (error) {
      console.error(
        "Certificate metadata persistence failed; orphaned R2 object cleanup may be required",
      );
      throw error;
    }
    return NextResponse.json(
      {
        success: true,
        message: "Certificate saved.",
        ...(duplicateCombination && !reuseExisting
          ? {
              warning:
                "Duplicate name combination detected: add a date of birth or admission number so students can be told apart.",
            }
          : {}),
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
