import { randomUUID, createHash } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { formString } from "@/app/api/_lib/form-data";
import { publishCertificateWithoutReview } from "@/server/certificate-auto-publish";
import {
  createCertificateNumberIndex,
  replaceCertificateNumberIndex,
  DuplicateCertificateNumberError,
  removeCertificateNumberIndex,
} from "@/server/certificate-index";
import { encryptCertificateNumber } from "@/server/certificate-number";
import { db } from "@/server/firebase-admin";
import { ensurePublicSessions, rebuildPublicSessions } from "@/server/public-sessions";
import { uploadCertificate, softDeleteR2Object, certificateTypeSlug } from "@/server/r2";
import { requireRoles, requireSensitiveReauth, writeAuditLog, apiError } from "@/server/security";
import { consumeAdminUploadQuota, rejectOversizedRequest } from "@/server/upload-policy";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { canReplacePublishedCertificate } from "@/shared/certificate-lifecycle";
import { duplicateFileDecision } from "@/shared/certificate-lifecycle";
import { UPLOAD_MAX_BYTES } from "@/shared/upload-limits";
import { certificateMetadataSchema } from "@/shared/validation";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReplacementMetadata = ReturnType<typeof certificateMetadataSchema.parse>;

function parseReplacementMetadata(form: FormData, current: FirebaseFirestore.DocumentSnapshot) {
  return certificateMetadataSchema.safeParse({
    session: String(form.get("session") ?? current.get("session")),
    type: String(form.get("type") ?? current.get("type")),
    certificateNumber: formString(form, "certificateNumber"),
    issueDate: String(form.get("issueDate") ?? current.get("issueDate")),
  });
}

async function replacementStudentError(
  studentId: string,
  session: string,
  type: string,
): Promise<NextResponse | null> {
  const student = await db.collection("students").doc(studentId).get();
  const matchesSession =
    student.exists &&
    normalizeAcademicSession(String(student.get("session") ?? "")) ===
      normalizeAcademicSession(session);
  if (!matchesSession)
    return NextResponse.json(
      { error: "Replacement session must match the student's passing session." },
      { status: 400 },
    );
  const [sessionDoc, typeDoc] = await Promise.all([
    db.collection("sessions").doc(session).get(),
    db.collection("certificateTypes").doc(certificateTypeSlug(type)).get(),
  ]);
  return sessionDoc.exists && typeDoc.exists
    ? null
    : NextResponse.json({ error: "Unknown session or certificate type." }, { status: 400 });
}

async function duplicateReplacementError(
  file: File,
  studentId: string,
  type: string,
  form: FormData,
): Promise<{
  response: NextResponse | null;
  sameHash: FirebaseFirestore.QuerySnapshot;
  reason: string;
}> {
  const hash = createHash("sha256")
    .update(Buffer.from(await file.arrayBuffer()))
    .digest("hex");
  const sameHash = await db.collection("certificates").where("sha256", "==", hash).get();
  const duplicateDecision = duplicateFileDecision(
    sameHash.docs.map((doc) => {
      const student: unknown = doc.get("studentId");
      const certificateType: unknown = doc.get("type");
      return { studentId: student, type: certificateType };
    }),
    studentId,
    type,
  );
  if (duplicateDecision === "block-same-student-type")
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
  const warningNotConfirmed =
    duplicateDecision === "warn-cross-record" && (!confirmed || reason.length < 10);
  return warningNotConfirmed
    ? {
        response: NextResponse.json(
          {
            error:
              "This file matches another certificate. Confirm this is intentional and provide a reason.",
            duplicateFileWarning: true,
          },
          { status: 409 },
        ),
        sameHash,
        reason,
      }
    : { response: null, sameHash, reason };
}

async function saveReplacement(input: {
  request: NextRequest;
  file: File;
  adminUid: string;
  studentId: string;
  certificateId: string;
  metadata: ReplacementMetadata;
  sameHash: FirebaseFirestore.QuerySnapshot;
  duplicateReason: string;
}): Promise<{ response: NextResponse | null; replacementId: string }> {
  const { request, file, adminUid, studentId, certificateId, metadata, sameHash, duplicateReason } =
    input;
  const stored = await uploadCertificate({
    file,
    session: metadata.session,
    certificateType: metadata.type,
    studentId,
    uploaderUid: adminUid,
    request,
  });
  const replacementRef = db.collection("certificates").doc(randomUUID());
  try {
    await createCertificateNumberIndex(
      metadata.certificateNumber,
      replacementRef.id,
      metadata.session,
    );
    await replacementRef.set({
      publicId: randomUUID().replace(/-/g, ""),
      studentId,
      session: metadata.session,
      type: metadata.type,
      certificateNumberEncrypted: encryptCertificateNumber(metadata.certificateNumber),
      r2Key: stored.r2Key,
      fileName: stored.fileName,
      mimeType: stored.mimeType,
      size: stored.size,
      sha256: stored.sha256,
      scanStatus: stored.scanStatus,
      scannedAt: stored.scannedAt,
      scannerVersion: stored.scannerVersion,
      signatureDatabaseDate: stored.signatureDatabaseDate,
      issueDate: metadata.issueDate,
      status: "pending",
      published: false,
      uploadedBy: adminUid,
      replacesId: certificateId,
      createdAt: FieldValue.serverTimestamp(),
      ...(sameHash.empty
        ? {}
        : {
            duplicateFileConfirmed: true,
            duplicateFileReason: duplicateReason,
            duplicateFileMatches: sameHash.docs.map((doc) => doc.id),
          }),
    });
    return { response: null, replacementId: replacementRef.id };
  } catch (error) {
    await removeCertificateNumberIndex(replacementRef.id).catch(() => null);
    await softDeleteR2Object(stored.r2Key, studentId).catch(() => null);
    if (error instanceof DuplicateCertificateNumberError)
      return {
        response: NextResponse.json(
          { error: "That certificate number is already assigned." },
          { status: 409 },
        ),
        replacementId: "",
      };
    throw error;
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    const admin = await requireRoles(request, ["approver", "admin"]);
    const { certificateId } = await context.params;
    const parsed = certificateMetadataSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid certificate metadata." }, { status: 400 });
    const { session, type } = parsed.data;
    const [sessionDoc, typeDoc] = await Promise.all([
      db.collection("sessions").doc(session).get(),
      db.collection("certificateTypes").doc(certificateTypeSlug(type)).get(),
    ]);
    if (!sessionDoc.exists || !typeDoc.exists)
      return NextResponse.json({ error: "Unknown session or certificate type." }, { status: 400 });
    const ref = db.collection("certificates").doc(certificateId);
    const current = await ref.get();
    if (!current.exists)
      return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
    if (current.get("status") !== "pending")
      return NextResponse.json(
        {
          error:
            "Only pending certificate metadata can be edited. Use Replace certificate for published records.",
        },
        { status: 409 },
      );
    if (current.get("session") !== session || current.get("type") !== type) {
      return NextResponse.json(
        {
          error: "Changing session or certificate type requires uploading the premade file again.",
        },
        { status: 400 },
      );
    }
    try {
      await replaceCertificateNumberIndex(parsed.data.certificateNumber, certificateId, session);
    } catch (error) {
      if (error instanceof DuplicateCertificateNumberError) {
        return NextResponse.json(
          { error: "That certificate number is already assigned." },
          { status: 409 },
        );
      }
      throw error;
    }
    const { certificateNumber, ...metadata } = parsed.data;
    await ref.update({
      ...metadata,
      certificateNumberEncrypted: encryptCertificateNumber(certificateNumber),
      updatedBy: admin.uid,
      updatedAt: new Date(),
    });
    await writeAuditLog(
      request,
      admin.uid,
      "certificate.update",
      certificateId,
      String(current.get("studentId") ?? ""),
    );
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    const admin = await requireRoles(request, ["uploader", "admin"]);
    const tooLarge = rejectOversizedRequest(request);
    if (tooLarge) return tooLarge;
    const { certificateId } = await context.params;
    const current = await db.collection("certificates").doc(certificateId).get();
    if (!current.exists || !canReplacePublishedCertificate(current.get("status")))
      return NextResponse.json(
        { error: "Only a published certificate can be replaced." },
        { status: 409 },
      );
    const form = await request.formData();
    const file = replacementFile(form.get("file"));
    if (file instanceof NextResponse) return file;
    const quotaError = await consumeAdminUploadQuota(admin.uid, file.size);
    if (quotaError) return NextResponse.json({ error: quotaError }, { status: 429 });
    return await completeReplacement({ request, admin, file, form, certificateId, current });
  } catch (error) {
    return apiError(error);
  }
}

function replacementFile(value: FormDataEntryValue | null): File | NextResponse {
  if (!(value instanceof File))
    return NextResponse.json({ error: "Select a replacement file." }, { status: 400 });
  if (value.size <= 0 || value.size > UPLOAD_MAX_BYTES)
    return NextResponse.json(
      { error: "Replacement file must be no larger than 4 MB." },
      { status: 413 },
    );
  return value;
}

async function completeReplacement(input: {
  request: NextRequest;
  admin: Awaited<ReturnType<typeof requireRoles>>;
  file: File;
  form: FormData;
  certificateId: string;
  current: FirebaseFirestore.DocumentSnapshot;
}): Promise<NextResponse> {
  const { request, admin, file, form, certificateId, current } = input;
  const parsed = parseReplacementMetadata(form, current);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid replacement metadata." }, { status: 400 });
  const studentId = String(current.get("studentId") ?? "");
  const studentError = await replacementStudentError(
    studentId,
    parsed.data.session,
    parsed.data.type,
  );
  if (studentError) return studentError;
  const duplicate = await duplicateReplacementError(file, studentId, parsed.data.type, form);
  if (duplicate.response) return duplicate.response;
  const saved = await saveReplacement({
    request,
    file,
    adminUid: admin.uid,
    studentId,
    certificateId,
    metadata: parsed.data,
    sameHash: duplicate.sameHash,
    duplicateReason: duplicate.reason,
  });
  if (saved.response) return saved.response;
  const autoPublished = await publishReplacementIfAuthorized(
    request,
    admin,
    saved.replacementId,
    certificateId,
  );
  await writeAuditLog(
    request,
    admin.uid,
    "certificate.reissue.uploaded",
    saved.replacementId,
    studentId,
  );
  return NextResponse.json(
    {
      ok: true,
      replacementId: saved.replacementId,
      status: autoPublished ? "published" : "pending",
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}

async function publishReplacementIfAuthorized(
  request: NextRequest,
  admin: Awaited<ReturnType<typeof requireRoles>>,
  replacementId: string,
  certificateId: string,
): Promise<boolean> {
  const autoPublished = admin.role === "admin" || admin.role === "superadmin";
  if (!autoPublished) return false;
  const publication = await publishCertificateWithoutReview(replacementId, admin.uid);
  await writeAuditLog(
    request,
    admin.uid,
    "certificate.auto_published",
    replacementId,
    publication.studentId,
  );
  await writeAuditLog(
    request,
    admin.uid,
    "certificate.replaced",
    certificateId,
    publication.studentId,
  );
  return true;
}
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    await requireSensitiveReauth(request, admin);
    const { certificateId } = await context.params;
    const ref = db.collection("certificates").doc(certificateId);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: "Certificate not found." }, { status: 404 });
    if (doc.get("status") === "published") await ensurePublicSessions();
    const r2Key = String(doc.get("r2Key") ?? "");
    if (r2Key) await softDeleteR2Object(r2Key, String(doc.get("studentId") ?? ""));
    await removeCertificateNumberIndex(certificateId);
    await ref.delete();
    if (doc.get("status") === "published") await rebuildPublicSessions();
    await writeAuditLog(
      request,
      admin.uid,
      "certificate.delete",
      certificateId,
      String(doc.get("studentId") ?? ""),
    );
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
