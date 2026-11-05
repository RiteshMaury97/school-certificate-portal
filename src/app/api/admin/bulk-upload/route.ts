import { randomUUID, createHash } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { formString } from "@/app/api/_lib/form-data";
import { publishCertificateWithoutReview } from "@/server/certificate-auto-publish";
import {
  createCertificateNumberIndex,
  DuplicateCertificateNumberError,
  removeCertificateNumberIndex,
} from "@/server/certificate-index";
import { encryptCertificateNumber } from "@/server/certificate-number";
import { db } from "@/server/firebase-admin";
import { uploadCertificate, softDeleteR2Object, certificateTypeSlug } from "@/server/r2";
import { apiError, requireRoles, writeAuditLog } from "@/server/security";
import { studentIdentifierHmac } from "@/server/student-pii";
import { consumeAdminUploadQuota, rejectOversizedRequest } from "@/server/upload-policy";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { duplicateFileDecision } from "@/shared/certificate-lifecycle";
import { UPLOAD_MAX_BYTES } from "@/shared/upload-limits";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function readFirestoreText(value: unknown): string {
  return typeof value === "string" ? value : "";
}
const mappingSchema = z
  .object({
    fileName: z.string().min(1).max(255),
    admissionNo: z.string().max(80).optional(),
    admissionNumber: z.string().max(80).optional(),
    studentId: z.string().max(160).optional(),
    session: z.string().regex(/^\d{4}-\d{2}$/),
    certificateType: z.string().min(2).max(60),
    certificateNumber: z.string().min(1).max(80),
    issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((x) =>
    [x.studentId, x.admissionNo, x.admissionNumber].some(
      (value) => typeof value === "string" && value.length > 0,
    ),
  );

async function findMappedStudent(map: z.infer<typeof mappingSchema>) {
  const byId = map.studentId ? await db.collection("students").doc(map.studentId).get() : null;
  if (byId) return byId;
  const admissionValue =
    [map.admissionNumber, map.admissionNo].find((value) => value?.length) ?? "";
  if (!admissionValue) return null;
  const admissionKey = studentIdentifierHmac(admissionValue);
  const match = await db
    .collection("students")
    .where("admissionNumberDisambiguationKey", "==", admissionKey)
    .limit(2)
    .get();
  if (match.size === 1) return match.docs[0] ?? null;
  if (match.size > 1) return null;
  const legacy = await db
    .collection("students")
    .where("admissionNo", "==", admissionValue)
    .limit(2)
    .get();
  return legacy.size === 1 ? (legacy.docs[0] ?? null) : null;
}

function validStudentSession(studentSession: unknown, requestedSession: string): boolean {
  const actual = typeof studentSession === "string" ? studentSession : "";
  return normalizeAcademicSession(actual) === normalizeAcademicSession(requestedSession);
}

async function catalogError(
  session: string,
  certificateType: string,
): Promise<NextResponse | null> {
  let typeSlug: string;
  try {
    typeSlug = certificateTypeSlug(certificateType);
  } catch {
    return NextResponse.json({ error: "Invalid certificate type." }, { status: 400 });
  }
  const [sessionDoc, typeDoc] = await Promise.all([
    db.collection("sessions").doc(session).get(),
    db.collection("certificateTypes").doc(typeSlug).get(),
  ]);
  return sessionDoc.exists && sessionDoc.get("isActive") !== false && typeDoc.exists
    ? null
    : NextResponse.json(
        { error: "Unknown or inactive session/certificate type." },
        { status: 400 },
      );
}

async function hashDuplicateError(
  file: File,
  studentId: string,
  certificateType: string,
  form: FormData,
): Promise<{
  response: NextResponse | null;
  sameHash: FirebaseFirestore.QuerySnapshot;
  reason: string;
}> {
  const sha256 = createHash("sha256")
    .update(Buffer.from(await file.arrayBuffer()))
    .digest("hex");
  const sameHash = await db.collection("certificates").where("sha256", "==", sha256).get();
  const decision = duplicateFileDecision(
    sameHash.docs.map((doc) => ({
      studentId: readFirestoreText(doc.get("studentId")),
      type: readFirestoreText(doc.get("type")),
    })),
    studentId,
    certificateType,
  );
  if (decision === "block-same-student-type")
    return {
      response: NextResponse.json(
        { error: "An identical file already exists for this student and certificate type." },
        { status: 409 },
      ),
      sameHash,
      reason: "",
    };
  const confirmed = formString(form, "confirmDuplicateHash") === "true";
  const reason = formString(form, "duplicateHashReason").trim();
  if (decision === "warn-cross-record" && (!confirmed || reason.length < 10))
    return {
      response: NextResponse.json(
        {
          error:
            "This file matches an existing certificate for a different record. Confirm this is intentional and provide a reason.",
          duplicateFileWarning: true,
        },
        { status: 409 },
      ),
      sameHash,
      reason,
    };
  return { response: null, sameHash, reason };
}

async function persistBulkCertificate(input: {
  request: NextRequest;
  admin: Awaited<ReturnType<typeof requireRoles>>;
  file: File;
  map: z.infer<typeof mappingSchema>;
  studentId: string;
  sameHash: FirebaseFirestore.QuerySnapshot;
  duplicateReason: string;
}): Promise<NextResponse> {
  const { request, admin, file, map, studentId, sameHash, duplicateReason } = input;
  const stored = await uploadCertificate({
    file,
    session: map.session,
    certificateType: map.certificateType,
    studentId,
    uploaderUid: admin.uid,
    request,
  });
  const ref = db.collection("certificates").doc(randomUUID());
  try {
    await createCertificateNumberIndex(map.certificateNumber, ref.id, map.session);
    await ref.set({
      publicId: randomUUID().replace(/-/g, ""),
      studentId,
      session: map.session,
      type: map.certificateType,
      certificateNumberEncrypted: encryptCertificateNumber(map.certificateNumber),
      r2Key: stored.r2Key,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      size: stored.size,
      sha256: stored.sha256,
      scanStatus: stored.scanStatus,
      scannedAt: stored.scannedAt,
      scannerVersion: stored.scannerVersion,
      signatureDatabaseDate: stored.signatureDatabaseDate,
      issueDate: map.issueDate,
      status: "pending",
      published: false,
      uploadedBy: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      ...(sameHash.empty
        ? {}
        : {
            duplicateFileConfirmed: true,
            duplicateFileReason: duplicateReason,
            duplicateFileMatches: sameHash.docs.map((doc) => doc.id),
          }),
    });
  } catch (error) {
    await removeCertificateNumberIndex(ref.id).catch(() => null);
    await softDeleteR2Object(stored.r2Key, studentId).catch(() => null);
    if (error instanceof DuplicateCertificateNumberError)
      return NextResponse.json({ error: "Duplicate certificate number." }, { status: 409 });
    throw error;
  }
  const elevated = admin.role === "admin" || admin.role === "superadmin";
  if (elevated) {
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
    { ok: true, certificateId: ref.id, status: elevated ? "published" : "pending" },
    { status: 201 },
  );
}
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["uploader", "admin"]);
    const tooLarge = rejectOversizedRequest(request);
    if (tooLarge) return tooLarge;
    const form = await request.formData();
    const fileResult = validateBulkFile(form.get("file"));
    const mapping = parseMapping(form);
    if (mapping instanceof NextResponse) return mapping;
    if (fileResult instanceof NextResponse) return fileResult;
    const file = fileResult;
    const quotaError = await consumeAdminUploadQuota(admin.uid, file.size);
    if (quotaError) return NextResponse.json({ error: quotaError }, { status: 429 });
    const mappingError = responseIfMappingMismatch(file.name, mapping);
    if (mappingError) return mappingError;
    const student = await findMappedStudent(mapping);
    if (!student?.exists)
      return NextResponse.json(
        { error: "Student not found or admission number is ambiguous." },
        { status: 404 },
      );
    if (!validStudentSession(student.get("session"), mapping.session))
      return NextResponse.json(
        { error: "Certificate session must match the student's passing session." },
        { status: 400 },
      );
    const invalidCatalog = await catalogError(mapping.session, mapping.certificateType);
    if (invalidCatalog) return invalidCatalog;
    const duplicate = await hashDuplicateError(file, student.id, mapping.certificateType, form);
    if (duplicate.response) return duplicate.response;
    return await persistBulkCertificate({
      request,
      admin,
      file,
      map: mapping,
      studentId: student.id,
      sameHash: duplicate.sameHash,
      duplicateReason: duplicate.reason,
    });
  } catch (error) {
    return apiError(error);
  }
}

function parseMapping(form: FormData): z.infer<typeof mappingSchema> | NextResponse {
  let rawMapping: unknown;
  try {
    const mappingJson = formString(form, "mapping");
    rawMapping = JSON.parse(mappingJson.length > 0 ? mappingJson : "{}");
  } catch {
    return NextResponse.json({ error: "Mapping JSON is invalid." }, { status: 400 });
  }
  const parsed = mappingSchema.safeParse(rawMapping);
  return parsed.success
    ? parsed.data
    : NextResponse.json({ error: "File and valid mapping are required." }, { status: 400 });
}

function validateBulkFile(file: FormDataEntryValue | null): File | NextResponse {
  if (!(file instanceof File))
    return NextResponse.json({ error: "File and valid mapping are required." }, { status: 400 });
  if (file.size <= 0 || file.size > UPLOAD_MAX_BYTES)
    return NextResponse.json({ error: "Each file must be no larger than 4 MB." }, { status: 413 });
  return file;
}

function responseIfMappingMismatch(fileName: string, mapping: z.infer<typeof mappingSchema>) {
  return mapping.fileName === fileName
    ? null
    : NextResponse.json(
        { error: "The uploaded file does not match the preview mapping." },
        { status: 400 },
      );
}
