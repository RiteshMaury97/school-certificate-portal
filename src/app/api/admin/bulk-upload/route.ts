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
export const maxDuration = 30;
export const dynamic = "force-dynamic";
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
  .refine((x) => Boolean(x.studentId || x.admissionNo || x.admissionNumber));
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["uploader", "admin"]);
    const tooLarge = rejectOversizedRequest(request);
    if (tooLarge) return tooLarge;
    const form = await request.formData();
    const file = form.get("file");
    let rawMapping: unknown = {};
    try {
      rawMapping = JSON.parse(String(form.get("mapping") ?? "{}"));
    } catch {
      return NextResponse.json({ error: "Mapping JSON is invalid." }, { status: 400 });
    }
    const parsed = mappingSchema.safeParse(rawMapping);
    if (!(file instanceof File) || !parsed.success)
      return NextResponse.json({ error: "File and valid mapping are required." }, { status: 400 });
    if (file.size <= 0 || file.size > UPLOAD_MAX_BYTES)
      return NextResponse.json(
        { error: "Each file must be no larger than 4 MB." },
        { status: 413 },
      );
    const quotaError = await consumeAdminUploadQuota(admin.uid, file.size);
    if (quotaError) return NextResponse.json({ error: quotaError }, { status: 429 });
    const map = parsed.data;
    if (map.fileName !== file.name)
      return NextResponse.json(
        { error: "The uploaded file does not match the preview mapping." },
        { status: 400 },
      );
    const studentQuery = map.studentId
      ? await db.collection("students").doc(map.studentId).get()
      : null;
    const admissionValue = map.admissionNumber || map.admissionNo || "";
    const admissionKey =
      !studentQuery && admissionValue ? studentIdentifierHmac(admissionValue) : "";
    const admissionQuery =
      !studentQuery && admissionKey
        ? await db
            .collection("students")
            .where("admissionNumberDisambiguationKey", "==", admissionKey)
            .limit(2)
            .get()
        : null;
    const legacyAdmissionQuery =
      !studentQuery && !admissionQuery?.size && admissionValue
        ? await db.collection("students").where("admissionNo", "==", admissionValue).limit(2).get()
        : null;
    const match = admissionQuery?.size ? admissionQuery : legacyAdmissionQuery;
    const student = studentQuery ?? (match?.size === 1 ? match.docs[0] : null);
    if (!student?.exists)
      return NextResponse.json(
        { error: "Student not found or admission number is ambiguous." },
        { status: 404 },
      );
    if (
      normalizeAcademicSession(String(student.get("session") ?? "")) !==
      normalizeAcademicSession(map.session)
    )
      return NextResponse.json(
        { error: "Certificate session must match the student's passing session." },
        { status: 400 },
      );
    let typeSlug = "";
    try {
      typeSlug = certificateTypeSlug(map.certificateType);
    } catch {
      return NextResponse.json({ error: "Invalid certificate type." }, { status: 400 });
    }
    const [sessionDoc, typeDoc] = await Promise.all([
      db.collection("sessions").doc(map.session).get(),
      db.collection("certificateTypes").doc(typeSlug).get(),
    ]);
    if (!sessionDoc.exists || sessionDoc.get("isActive") === false || !typeDoc.exists)
      return NextResponse.json(
        { error: "Unknown or inactive session/certificate type." },
        { status: 400 },
      );
    const sha256 = createHash("sha256")
      .update(Buffer.from(await file.arrayBuffer()))
      .digest("hex");
    const sameHash = await db.collection("certificates").where("sha256", "==", sha256).get();
    const duplicateDecision = duplicateFileDecision(
      sameHash.docs.map((doc) => ({
        studentId: doc.get("studentId"),
        type: doc.get("type"),
      })),
      student.id,
      map.certificateType,
    );
    if (duplicateDecision === "block-same-student-type")
      return NextResponse.json(
        {
          error: "An identical file already exists for this student and certificate type.",
        },
        { status: 409 },
      );
    const intentional = formString(form, "confirmDuplicateHash") === "true";
    const duplicateReason = String(form.get("duplicateHashReason") ?? "").trim();
    if (duplicateDecision === "warn-cross-record" && (!intentional || duplicateReason.length < 10))
      return NextResponse.json(
        {
          error:
            "This file matches an existing certificate for a different record. Confirm this is intentional and provide a reason.",
          duplicateFileWarning: true,
        },
        { status: 409 },
      );
    const stored = await uploadCertificate(file, map.session, map.certificateType, student.id, admin.uid, request);
    const ref = db.collection("certificates").doc(randomUUID());
    try {
      await createCertificateNumberIndex(map.certificateNumber, ref.id, map.session);
      await ref.set({
        publicId: randomUUID().replace(/-/g, ""),
        studentId: student.id,
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
      await softDeleteR2Object(stored.r2Key, student.id).catch(() => null);
      if (error instanceof DuplicateCertificateNumberError)
        return NextResponse.json({ error: "Duplicate certificate number." }, { status: 409 });
      throw error;
    }
    if (admin.role === "admin" || admin.role === "superadmin") {
      await publishCertificateWithoutReview(ref.id, admin.uid);
      await writeAuditLog(request, admin.uid, "certificate.auto_published", ref.id, student.id);
    }
    await writeAuditLog(request, admin.uid, "certificate.upload", ref.id, student.id);
    if (!sameHash.empty)
      await writeAuditLog(
        request,
        admin.uid,
        "certificate.duplicate_hash_override",
        ref.id,
        student.id,
      );
    return NextResponse.json(
      {
        ok: true,
        certificateId: ref.id,
        status: admin.role === "admin" || admin.role === "superadmin" ? "published" : "pending",
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
