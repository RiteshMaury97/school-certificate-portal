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
import { consumeAdminUploadQuota, rejectOversizedRequest } from "@/server/upload-policy";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { duplicateFileDecision } from "@/shared/certificate-lifecycle";
import { UPLOAD_MAX_BYTES } from "@/shared/upload-limits";
import { isValidPhoneNumber, normalize, studentCreateSchema } from "@/shared/validation";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function readFirestoreText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["uploader", "admin", "superadmin"]);
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const tooLarge = rejectOversizedRequest(request);
    if (tooLarge) return tooLarge;
    const form = await request.formData();
    const parsed = await validateStudentUpload(form, admin.uid);
    if (parsed instanceof NextResponse) return parsed;
    const identity = await resolveStudentIdentity(parsed.data);
    if (identity instanceof NextResponse) return identity;
    return await storeStudentCertificate({
      request,
      admin,
      form,
      file: parsed.file,
      data: parsed.data,
      identity,
    });
  } catch (error) {
    return apiError(error);
  }
}

type StudentData = ReturnType<typeof studentCreateSchema.parse>;
type StudentIdentity = {
  searchKey: string;
  scholarLookupKey: string;
  dateOfBirth: string;
  admissionNumber: string;
  dateOfBirthDisambiguationKey: string;
  admissionNumberDisambiguationKey: string;
  duplicateCombination: boolean;
  reuseExisting: boolean;
  studentRef: FirebaseFirestore.DocumentReference;
};

async function validateStudentUpload(
  form: FormData,
  adminUid: string,
): Promise<{ data: StudentData; file: File } | NextResponse> {
  const admissionNumberInput = formString(form, "admissionNumber");
  const rawSession = formString(form, "session");
  const parsed = studentCreateSchema.safeParse({
    admissionNo: formString(form, "admissionNo").trim(),
    admissionNumber: (admissionNumberInput || formString(form, "admissionNo")).trim(),
    dateOfBirth: formString(form, "dateOfBirth").trim(),
    studentName: formString(form, "studentName"),
    fatherName: formString(form, "fatherName"),
    motherName: formString(form, "motherName"),
    className: formString(form, "className"),
    scholarNumber: formString(form, "scholarNumber"),
    session: normalizeAcademicSession(rawSession) ?? rawSession,
    certificateType: formString(form, "certificateType"),
    certificateNumber: formString(form, "certificateNumber"),
    issuedAt: formString(form, "issuedAt"),
  });
  const file = form.get("file");
  if (!parsed.success || !(file instanceof File)) return studentFormError(parsed, file);
  if (file.size <= 0 || file.size > UPLOAD_MAX_BYTES)
    return NextResponse.json(
      { error: "Certificate must be no larger than 4 MB." },
      { status: 413 },
    );
  const quotaError = await consumeAdminUploadQuota(adminUid, file.size);
  return quotaError
    ? NextResponse.json({ error: quotaError }, { status: 429 })
    : { data: parsed.data, file };
}

function studentFormError(
  parsed: ReturnType<typeof studentCreateSchema.safeParse>,
  file: FormDataEntryValue | null,
): NextResponse {
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
  const error = problems.length
    ? `Please correct the following: ${problems.join("; ")}`
    : "Complete every required field and attach a valid certificate.";
  return NextResponse.json({ error }, { status: 400 });
}

function notificationDetails(
  form: FormData,
): { parentEmail: string; parentMobile: string; consent: boolean } | NextResponse {
  const parentEmail = formString(form, "parentEmail").trim().toLowerCase();
  const parentMobile = formString(form, "parentMobile").trim();
  const consent = formString(form, "notificationConsent") === "true";
  const hasContact = Boolean(parentEmail || parentMobile);
  const validEmail = !parentEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail);
  const validPhone = !parentMobile || isValidPhoneNumber(parentMobile);
  if ((consent && !hasContact) || (hasContact && (!consent || !validEmail || !validPhone)))
    return NextResponse.json(
      { error: "A valid parent contact and explicit notification consent are required." },
      { status: 400 },
    );
  return { parentEmail, parentMobile, consent };
}

async function resolveStudentIdentity(data: StudentData): Promise<StudentIdentity | NextResponse> {
  const notification = await resolveIdentityKeys(data);
  if (notification instanceof NextResponse) return notification;
  const {
    searchKey,
    scholarLookupKey,
    matching,
    dateOfBirth,
    admissionNumber,
    dateOfBirthDisambiguationKey,
    admissionNumberDisambiguationKey,
  } = notification;
  const duplicateCombination = !matching.empty;
  if (
    duplicateCombination &&
    ((!dateOfBirthDisambiguationKey && !admissionNumberDisambiguationKey) ||
      matching.docs.some(
        (doc) =>
          !doc.get("dateOfBirthDisambiguationKey") && !doc.get("admissionNumberDisambiguationKey"),
      ))
  )
    return NextResponse.json(
      {
        error:
          "Duplicate name combination detected: add a date of birth or admission number so students can be told apart.",
      },
      { status: 409 },
    );
  const identified = matching.docs.filter((doc) =>
    studentIdentityMatches(
      doc.data(),
      dateOfBirthDisambiguationKey,
      admissionNumberDisambiguationKey,
    ),
  );
  if (identified.length > 1)
    return NextResponse.json(
      {
        error:
          "The supplied identity details match multiple student records. Review the existing records before continuing.",
      },
      { status: 409 },
    );
  const reuseExisting = identified.length === 1;
  const existing = identified.at(0) ?? matching.docs.at(0);
  const missingMatch = unavailableMatchedStudent(reuseExisting, existing);
  if (missingMatch) return missingMatch;
  const studentRef = reuseExisting && existing
    ? existing.ref
    : db.collection("students").doc(randomUUID());
  const catalogError = await validateStudentCatalog(data);
  if (catalogError) return catalogError;
  return {
    searchKey,
    scholarLookupKey,
    dateOfBirth,
    admissionNumber,
    dateOfBirthDisambiguationKey,
    admissionNumberDisambiguationKey,
    duplicateCombination,
    reuseExisting,
    studentRef,
  };
}

function unavailableMatchedStudent(
  reuseExisting: boolean,
  existing: FirebaseFirestore.QueryDocumentSnapshot | undefined,
): NextResponse | null {
  return reuseExisting && !existing
    ? NextResponse.json({ error: "Student match is no longer available." }, { status: 409 })
    : null;
}

async function resolveIdentityKeys(data: StudentData) {
  const searchKey = createSearchKey(data);
  const scholarLookupKey = scholarLookupHmac(data.scholarNumber, data.className, data.session);
  const scholarMatches = await db
    .collection("students")
    .where("scholarLookupKey", "==", scholarLookupKey)
    .get();
  if (scholarMatches.docs.some((doc) => doc.get("searchKey") !== searchKey))
    return NextResponse.json(
      { error: "That scholar number is already assigned in this class and session." },
      { status: 409 },
    );
  const matching = await db.collection("students").where("searchKey", "==", searchKey).get();
  const dateOfBirth = data.dateOfBirth ?? "";
  const admissionNumber = data.admissionNumber ?? "";
  return {
    searchKey,
    scholarLookupKey,
    matching,
    dateOfBirth,
    admissionNumber,
    dateOfBirthDisambiguationKey: dateOfBirth ? studentIdentifierHmac(dateOfBirth) : "",
    admissionNumberDisambiguationKey: admissionNumber ? studentIdentifierHmac(admissionNumber) : "",
  };
}

async function validateStudentCatalog(data: StudentData): Promise<NextResponse | null> {
  const typeSlug = slugify(data.certificateType);
  if (!typeSlug) return NextResponse.json({ error: "Invalid certificate type." }, { status: 400 });
  const sessionDoc = await findAcademicSessionDocument(data.session);
  const typeDoc = await db.collection("certificateTypes").doc(typeSlug).get();
  return sessionDoc.exists && sessionDoc.get("isActive") !== false && typeDoc.exists
    ? null
    : NextResponse.json(
        { error: "Select an active session and configured certificate type." },
        { status: 400 },
      );
}

async function storeStudentCertificate(input: {
  request: NextRequest;
  admin: Awaited<ReturnType<typeof requireRoles>>;
  form: FormData;
  file: File;
  data: StudentData;
  identity: StudentIdentity;
}): Promise<NextResponse> {
  const { request, admin, form, file, data, identity } = input;
  const notification = notificationDetails(form);
  if (notification instanceof NextResponse) return notification;
  const duplicate = await checkDuplicateFile(
    file,
    identity.studentRef.id,
    data.certificateType,
    form,
  );
  if (duplicate instanceof NextResponse) return duplicate;
  const stored = await uploadCertificate({
    file,
    session: data.session,
    certificateType: data.certificateType,
    studentId: identity.studentRef.id,
    uploaderUid: admin.uid,
    request,
  });
  try {
    const now = FieldValue.serverTimestamp();
    await writeStudentRecord({ data, identity, notification, adminUid: admin.uid, now });
    const certificateId = await saveStudentCertificateRecord({
      data,
      identity,
      duplicate,
      stored,
      adminUid: admin.uid,
    });
    await logStudentCertificate({
      request,
      admin,
      identity,
      duplicate,
      notification,
      certificateId,
      now,
    });
    return NextResponse.json(studentCreatedResponse(identity), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_CERTIFICATE_NUMBER")
      return NextResponse.json(
        { error: "That certificate number is already assigned." },
        { status: 409 },
      );
    console.error(
      "Certificate metadata persistence failed; orphaned R2 object cleanup may be required",
    );
    throw error;
  }
}

async function checkDuplicateFile(
  file: File,
  studentId: string,
  certificateType: string,
  form: FormData,
): Promise<{ sameHash: FirebaseFirestore.QuerySnapshot; reason: string } | NextResponse> {
  const fileHash = createHash("sha256")
    .update(Buffer.from(await file.arrayBuffer()))
    .digest("hex");
  const sameHash = await db.collection("certificates").where("sha256", "==", fileHash).get();
  const decision = duplicateFileDecision(
    sameHash.docs.map((doc) => ({
      studentId: readFirestoreText(doc.get("studentId")),
      type: readFirestoreText(doc.get("type")),
    })),
    studentId,
    certificateType,
  );
  const confirmed = formString(form, "confirmDuplicateHash") === "true";
  const reason = formString(form, "duplicateHashReason").trim();
  if (decision === "block-same-student-type")
    return NextResponse.json(
      { error: "An identical file already exists for this student and certificate type." },
      { status: 409 },
    );
  if (decision === "warn-cross-record" && (!confirmed || reason.length < 10))
    return NextResponse.json(
      {
        error:
          "This file matches an existing certificate for a different record. Confirm this is intentional and provide a reason.",
        duplicateFileWarning: true,
      },
      { status: 409 },
    );
  return { sameHash, reason };
}

async function writeStudentRecord(input: {
  data: StudentData;
  identity: StudentIdentity;
  notification: { parentEmail: string; parentMobile: string; consent: boolean };
  adminUid: string;
  now: FirebaseFirestore.FieldValue;
}): Promise<void> {
  const { data, identity, notification, adminUid, now } = input;
  const base = {
    studentName: data.studentName,
    fatherName: data.fatherName,
    motherName: data.motherName,
    className: data.className,
    scholarNumber: encryptStudentIdentifier(data.scholarNumber),
    scholarLookupKey: identity.scholarLookupKey,
    ...(identity.admissionNumber
      ? {
          admissionNumber: encryptStudentIdentifier(identity.admissionNumber),
          admissionNumberDisambiguationKey: identity.admissionNumberDisambiguationKey,
        }
      : {}),
    ...(identity.dateOfBirth
      ? {
          dateOfBirth: encryptStudentIdentifier(identity.dateOfBirth),
          dateOfBirthDisambiguationKey: identity.dateOfBirthDisambiguationKey,
        }
      : {}),
    ...(notification.consent
      ? {
          parentEmail: notification.parentEmail,
          parentMobile: notification.parentMobile,
          notificationConsent: true,
          notificationConsentAt: now,
          notificationConsentPurpose: "certificate_availability",
          ...(identity.reuseExisting ? { notificationOptOut: false } : {}),
        }
      : {}),
  };
  if (identity.reuseExisting) {
    await identity.studentRef.update({
      ...base,
      ...(identity.admissionNumber ? { admissionNo: FieldValue.delete() } : {}),
      updatedAt: now,
    });
    return;
  }
  await identity.studentRef.set({
    ...base,
    session: data.session,
    searchKey: identity.searchKey,
    createdAt: now,
    updatedAt: now,
    createdBy: adminUid,
  });
}

async function saveStudentCertificateRecord(input: {
  data: StudentData;
  identity: StudentIdentity;
  duplicate: { sameHash: FirebaseFirestore.QuerySnapshot; reason: string };
  stored: Awaited<ReturnType<typeof uploadCertificate>>;
  adminUid: string;
}): Promise<string> {
  const { data, identity, duplicate, stored, adminUid } = input;
  const certificateRef = db.collection("certificates").doc(randomUUID());
  try {
    await createCertificateNumberIndex(data.certificateNumber, certificateRef.id, data.session);
    await certificateRef.set({
      publicId: randomUUID().replace(/-/g, ""),
      studentId: identity.studentRef.id,
      session: data.session,
      type: data.certificateType,
      certificateNumberEncrypted: encryptCertificateNumber(data.certificateNumber),
      r2Key: stored.r2Key,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      size: stored.size,
      sha256: stored.sha256,
      scanStatus: stored.scanStatus,
      scannedAt: stored.scannedAt,
      scannerVersion: stored.scannerVersion,
      signatureDatabaseDate: stored.signatureDatabaseDate,
      issueDate: data.issuedAt,
      status: "pending",
      published: false,
      uploadedBy: adminUid,
      createdAt: FieldValue.serverTimestamp(),
      ...(duplicate.sameHash.empty
        ? {}
        : {
            duplicateFileConfirmed: true,
            duplicateFileReason: duplicate.reason,
            duplicateFileMatches: duplicate.sameHash.docs.map((doc) => doc.id),
          }),
    });
    return certificateRef.id;
  } catch (error) {
    await removeCertificateNumberIndex(certificateRef.id).catch(() => {
      console.error("Certificate index cleanup failed");
    });
    await softDeleteR2Object(stored.r2Key, identity.studentRef.id).catch(() => {
      console.error("Orphan R2 cleanup failed");
    });
    if (error instanceof DuplicateCertificateNumberError) {
      if (!identity.reuseExisting)
        await identity.studentRef
          .delete()
          .catch(() => {
            console.error("Empty student record cleanup failed");
          });
      throw new Error("DUPLICATE_CERTIFICATE_NUMBER");
    }
    throw error;
  }
}

async function logStudentCertificate(input: {
  request: NextRequest;
  admin: Awaited<ReturnType<typeof requireRoles>>;
  identity: StudentIdentity;
  duplicate: { sameHash: FirebaseFirestore.QuerySnapshot; reason: string };
  notification: { parentEmail: string; parentMobile: string; consent: boolean };
  certificateId: string;
  now: FirebaseFirestore.FieldValue;
}): Promise<void> {
  const { request, admin, identity, duplicate, notification, certificateId, now } = input;
  const studentId = identity.studentRef.id;
  if (admin.role === "admin" || admin.role === "superadmin") {
    await publishCertificateWithoutReview(certificateId, admin.uid);
    await writeAuditLog(request, admin.uid, "certificate.auto_published", certificateId, studentId);
  }
  await writeAuditLog(request, admin.uid, "certificate.upload", certificateId, studentId);
  if (!duplicate.sameHash.empty)
    await writeAuditLog(
      request,
      admin.uid,
      "certificate.duplicate_hash_override",
      certificateId,
      studentId,
    );
  if (!identity.reuseExisting)
    await writeAuditLog(request, admin.uid, "student.create", studentId, studentId);
  if (notification.consent)
    await db.collection("notificationConsents").add({
      studentId,
      consentGiven: true,
      purpose: "certificate_availability",
      contactChannels: [
        notification.parentEmail ? "email" : "",
        notification.parentMobile ? "sms" : "",
      ].filter(Boolean),
      timestamp: now,
      collectedBy: admin.uid,
    });
}

function studentCreatedResponse(identity: StudentIdentity) {
  return {
    success: true,
    message: "Certificate saved.",
    ...(identity.duplicateCombination && !identity.reuseExisting
      ? {
          warning:
            "Duplicate name combination detected: add a date of birth or admission number so students can be told apart.",
        }
      : {}),
  };
}
