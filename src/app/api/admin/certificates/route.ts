import { randomUUID, createHash } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { formString } from "@/app/api/_lib/form-data";
import { findAcademicSessionDocument } from "@/server/academic-session";
import { publishCertificateWithoutReview } from "@/server/certificate-auto-publish";
import {
  createCertificateNumberIndex,
  DuplicateCertificateNumberError,
  removeCertificateNumberIndex,
} from "@/server/certificate-index";
import { encryptCertificateNumber, decryptCertificateNumber } from "@/server/certificate-number";
import { db } from "@/server/firebase-admin";
import { uploadCertificate, certificateTypeSlug } from "@/server/r2";
import { softDeleteR2Object } from "@/server/r2";
import { requireRoles, writeAuditLog, apiError } from "@/server/security";
import { consumeAdminUploadQuota, rejectOversizedRequest } from "@/server/upload-policy";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { duplicateFileDecision } from "@/shared/certificate-lifecycle";
import { UPLOAD_MAX_BYTES } from "@/shared/upload-limits";
import { certificateUploadMetadataSchema } from "@/shared/validation";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeDocumentValue(document: { get(field: string): unknown }, field: string): unknown {
  const value: unknown = document.get(field);
  return value;
}

function documentTimestampIso(document: { get(field: string): unknown }, field: string) {
  const value = safeDocumentValue(document, field);
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function documentString(document: { get(field: string): unknown }, field: string): string {
  const value = safeDocumentValue(document, field);
  return typeof value === "string" ? value : "";
}

type CertificateAdmin = Awaited<ReturnType<typeof requireRoles>>;

async function findDuplicateCertificate(
  file: File,
  studentId: string,
  type: string,
  form: FormData,
) {
  const fileBytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(fileBytes).digest("hex");
  const sameHash = await db.collection("certificates").where("sha256", "==", sha256).get();
  const decision = duplicateFileDecision(
    sameHash.docs.map((document) => ({
      studentId: safeDocumentValue(document, "studentId"),
      type: safeDocumentValue(document, "type"),
    })),
    studentId,
    type,
  );
  const reason = formString(form, "duplicateHashReason").trim();
  if (decision === "block-same-student-type")
    return {
      sameHash,
      reason,
      response: NextResponse.json(
        {
          error: "An identical file already exists for this student and certificate type.",
        },
        { status: 409 },
      ),
    };
  if (
    decision === "warn-cross-record" &&
    (formString(form, "confirmDuplicateHash") !== "true" || reason.length < 10)
  )
    return {
      sameHash,
      reason,
      response: NextResponse.json(
        {
          error:
            "This file matches an existing certificate for a different record. Confirm that this is intentional and provide a reason.",
          duplicateFileWarning: true,
        },
        { status: 409 },
      ),
    };
  return { sameHash, reason, response: null };
}

async function storeCertificateRecord(
  request: NextRequest,
  admin: CertificateAdmin,
  details: {
    studentId: string;
    session: string;
    type: string;
    certificateNumber: string;
    issueDate: string;
  },
  file: File,
  sameHash: Awaited<ReturnType<typeof findDuplicateCertificate>>["sameHash"],
  duplicateReason: string,
) {
  const { studentId, session, type, certificateNumber, issueDate } = details;
  const stored = await uploadCertificate({
    file,
    session,
    certificateType: type,
    studentId,
    uploaderUid: admin.uid,
    request,
  });
  const ref = db.collection("certificates").doc(randomUUID());
  try {
    await createCertificateNumberIndex(certificateNumber, ref.id, session);
    await ref.set({
      publicId: randomUUID().replace(/-/g, ""),
      studentId,
      session,
      type,
      r2Key: stored.r2Key,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      certificateNumberEncrypted: encryptCertificateNumber(certificateNumber),
      size: stored.size,
      sha256: stored.sha256,
      scanStatus: stored.scanStatus,
      scannedAt: stored.scannedAt,
      scannerVersion: stored.scannerVersion,
      signatureDatabaseDate: stored.signatureDatabaseDate,
      issueDate,
      status: "pending",
      published: false,
      uploadedBy: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      ...(sameHash.empty
        ? {}
        : {
            duplicateFileConfirmed: true,
            duplicateFileReason: duplicateReason,
            duplicateFileMatches: sameHash.docs.map((document) => document.id),
          }),
    });
  } catch (error) {
    await removeCertificateNumberIndex(ref.id).catch(() => {
      console.error("Certificate number index cleanup failed");
    });
    await softDeleteR2Object(stored.r2Key, studentId).catch(() => {
      console.error("Orphan R2 object cleanup failed");
    });
    if (error instanceof DuplicateCertificateNumberError)
      return NextResponse.json(
        { error: "That certificate number is already assigned." },
        { status: 409 },
      );
    console.error("Certificate metadata persistence failed");
    throw error;
  }
  if (admin.role === "admin" || admin.role === "superadmin") {
    await publishCertificateWithoutReview(ref.id, admin.uid);
    await writeAuditLog(request, admin.uid, "certificate.auto_published", ref.id, studentId);
  }
  await writeAuditLog(request, admin.uid, "certificate.upload", ref.id, studentId);
  if (!sameHash.empty)
    await writeAuditLog(
      request,
      admin.uid,
      "certificate.duplicate_hash_override",
      ref.id,
      studentId,
    );
  return NextResponse.json(
    { ok: true, uploaded: { id: ref.id, fileName: stored.fileName } },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["uploader", "approver", "admin", "superadmin"]);
    const studentId = request.nextUrl.searchParams.get("studentId");
    const status = request.nextUrl.searchParams.get("status");
    const collection = db.collection("certificates");
    const query = studentId
      ? collection.where("studentId", "==", studentId)
      : status && ["pending", "published", "superseded", "revoked", "rejected"].includes(status)
        ? collection.where("status", "==", status)
        : collection.orderBy("createdAt", "desc");
    const snap = await query.limit(200).get();
    const selected = snap.docs.filter(
      (doc) => !status || safeDocumentValue(doc, "status") === status,
    );
    const studentIds = [
      ...new Set(selected.map((doc) => documentString(doc, "studentId")).filter(Boolean)),
    ];
    const studentDocs = await Promise.all(
      studentIds.map((id) => db.collection("students").doc(id).get()),
    );
    const studentDetails = new Map(
      studentDocs
        .filter((doc) => doc.exists)
        .map((doc) => [
          doc.id,
          {
            studentName: documentString(doc, "studentName"),
            fatherName: documentString(doc, "fatherName"),
            motherName: documentString(doc, "motherName"),
          },
        ]),
    );
    return NextResponse.json(
      {
        certificates: selected.map((doc) => ({
          id: doc.id,
          studentId: safeDocumentValue(doc, "studentId"),
          ...(studentDetails.get(documentString(doc, "studentId")) ?? {
            studentName: "",
            fatherName: "",
            motherName: "",
          }),
          session: safeDocumentValue(doc, "session"),
          type: safeDocumentValue(doc, "type"),
          certificateNumber: decryptCertificateNumber(
            safeDocumentValue(doc, "certificateNumberEncrypted"),
          ),
          issueDate: safeDocumentValue(doc, "issueDate"),
          fileName: safeDocumentValue(doc, "fileName"),
          mimeType: safeDocumentValue(doc, "mimeType"),
          scanStatus: safeDocumentValue(doc, "scanStatus") ?? "error",
          scannedAt: documentTimestampIso(doc, "scannedAt"),
          scannerVersion: safeDocumentValue(doc, "scannerVersion") ?? "",
          signatureDatabaseDate: safeDocumentValue(doc, "signatureDatabaseDate") ?? "",
          size: safeDocumentValue(doc, "size"),
          status: safeDocumentValue(doc, "status") ?? "pending",
          downloadCount: Number(safeDocumentValue(doc, "downloadCount") ?? 0),
          lastDownloadedAt: documentTimestampIso(doc, "lastDownloadedAt"),
          uploadedBy: safeDocumentValue(doc, "uploadedBy"),
          replacesId: safeDocumentValue(doc, "replacesId") ?? null,
          supersededBy: safeDocumentValue(doc, "supersededBy") ?? null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["uploader", "admin", "superadmin"]);
    const tooLarge = rejectOversizedRequest(request);
    if (tooLarge) return tooLarge;
    const form = await request.formData();
    const parsed = certificateUploadMetadataSchema.safeParse({
      studentId: formString(form, "studentId"),
      session: normalizeAcademicSession(formString(form, "session")) ?? formString(form, "session"),
      type: formString(form, "certificateType"),
      certificateNumber: formString(form, "certificateNumber"),
      issueDate: formString(form, "issuedAt"),
    });
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid certificate metadata." }, { status: 400 });
    const { studentId, session, type, certificateNumber, issueDate } = parsed.data;
    const student = await db.collection("students").doc(studentId).get();
    if (!student.exists) return NextResponse.json({ error: "Student not found." }, { status: 404 });
    if (
      normalizeAcademicSession(documentString(student, "session")) !==
      normalizeAcademicSession(session)
    )
      return NextResponse.json(
        { error: "Certificate session must match the student's passing session." },
        { status: 400 },
      );
    const [sessionDoc, typeDoc] = await Promise.all([
      findAcademicSessionDocument(session),
      db.collection("certificateTypes").doc(certificateTypeSlug(type)).get(),
    ]);
    if (!sessionDoc.exists || sessionDoc.get("isActive") === false || !typeDoc.exists) {
      return NextResponse.json(
        { error: "Select an active session and configured certificate type." },
        { status: 400 },
      );
    }
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json({ error: "Select one finished certificate file." }, { status: 400 });
    if (file.size <= 0 || file.size > UPLOAD_MAX_BYTES)
      return NextResponse.json(
        { error: "Certificate must be no larger than 4 MB." },
        { status: 413 },
      );
    const quotaError = await consumeAdminUploadQuota(admin.uid, file.size);
    if (quotaError) return NextResponse.json({ error: quotaError }, { status: 429 });
    const duplicate = await findDuplicateCertificate(file, studentId, type, form);
    if (duplicate.response) return duplicate.response;
    return await storeCertificateRecord(
      request,
      admin,
      { studentId, session, type, certificateNumber, issueDate },
      file,
      duplicate.sameHash,
      duplicate.reason,
    );
  } catch (error) {
    return apiError(error);
  }
}
