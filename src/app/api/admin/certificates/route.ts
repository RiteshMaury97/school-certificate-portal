import { duplicateFileDecision } from "@/shared/certificate-lifecycle";
import {
  encryptCertificateNumber,
  decryptCertificateNumber,
} from "@/server/certificate-number";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/server/firebase-admin";
import { uploadCertificate, certificateTypeSlug } from "@/server/r2";
import { requireRoles, writeAuditLog, apiError } from "@/server/security";
import { certificateUploadMetadataSchema } from "@/shared/validation";
import {
  createCertificateNumberIndex,
  DuplicateCertificateNumberError,
  removeCertificateNumberIndex,
} from "@/server/certificate-index";
import { softDeleteR2Object } from "@/server/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["uploader", "approver"]);
    const studentId = request.nextUrl.searchParams.get("studentId");
    const status = request.nextUrl.searchParams.get("status");
    const collection = db.collection("certificates");
    const query = studentId
      ? collection.where("studentId", "==", studentId)
      : status &&
          [
            "pending",
            "published",
            "superseded",
            "revoked",
            "rejected",
          ].includes(status)
        ? collection.where("status", "==", status)
        : collection.orderBy("createdAt", "desc");
    const snap = await query.limit(200).get();
    const selected = snap.docs.filter(
      (doc) => !status || doc.get("status") === status,
    );
    const studentIds = [
      ...new Set(
        selected
          .map((doc) => String(doc.get("studentId") ?? ""))
          .filter(Boolean),
      ),
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
            studentName: String(doc.get("studentName") ?? ""),
            fatherName: String(doc.get("fatherName") ?? ""),
            motherName: String(doc.get("motherName") ?? ""),
          },
        ]),
    );
    return NextResponse.json(
      {
        certificates: selected.map((doc) => ({
          id: doc.id,
          studentId: doc.get("studentId"),
          ...(studentDetails.get(String(doc.get("studentId") ?? "")) ?? {
            studentName: "",
            fatherName: "",
            motherName: "",
          }),
          session: doc.get("session"),
          type: doc.get("type"),
          certificateNumber: decryptCertificateNumber(
            doc.get("certificateNumberEncrypted"),
          ),
          issueDate: doc.get("issueDate"),
          fileName: doc.get("fileName"),
          mimeType: doc.get("mimeType"),
          size: doc.get("size"),
          status: doc.get("status") ?? "pending",
          downloadCount: Number(doc.get("downloadCount") ?? 0),
          lastDownloadedAt:
            doc.get("lastDownloadedAt")?.toDate?.()?.toISOString?.() ?? null,
          uploadedBy: doc.get("uploadedBy"),
          replacesId: doc.get("replacesId") ?? null,
          supersededBy: doc.get("supersededBy") ?? null,
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
    const admin = await requireRoles(request, ["uploader"]);
    const form = await request.formData();
    const parsed = certificateUploadMetadataSchema.safeParse({
      studentId: String(form.get("studentId") ?? ""),
      session: String(form.get("session") ?? ""),
      type: String(form.get("certificateType") ?? ""),
      certificateNumber: String(form.get("certificateNumber") ?? ""),
      issueDate: String(form.get("issuedAt") ?? ""),
    });
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid certificate metadata." },
        { status: 400 },
      );
    const { studentId, session, type, certificateNumber, issueDate } =
      parsed.data;
    const student = await db.collection("students").doc(studentId).get();
    if (!student.exists)
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 },
      );
    const [sessionDoc, typeDoc] = await Promise.all([
      db.collection("sessions").doc(session).get(),
      db.collection("certificateTypes").doc(certificateTypeSlug(type)).get(),
    ]);
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
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json(
        { error: "Select one finished certificate file." },
        { status: 400 },
      );
    if (file.size <= 0 || file.size > 5 * 1024 * 1024)
      return NextResponse.json(
        { error: "Certificate must be no larger than 5 MB." },
        { status: 413 },
      );
    const fileBytes = Buffer.from(await file.arrayBuffer());
    const sha256 = createHash("sha256").update(fileBytes).digest("hex");
    const sameHash = await db
      .collection("certificates")
      .where("sha256", "==", sha256)
      .get();
    const duplicateDecision = duplicateFileDecision(
      sameHash.docs.map((doc) => ({
        studentId: doc.get("studentId"),
        type: doc.get("type"),
      })),
      studentId,
      type,
    );
    if (duplicateDecision === "block-same-student-type")
      return NextResponse.json(
        {
          error:
            "An identical file already exists for this student and certificate type.",
        },
        { status: 409 },
      );
    const intentional =
      String(form.get("confirmDuplicateHash") ?? "") === "true";
    const duplicateReason = String(
      form.get("duplicateHashReason") ?? "",
    ).trim();
    if (
      duplicateDecision === "warn-cross-record" &&
      (!intentional || duplicateReason.length < 10)
    ) {
      return NextResponse.json(
        {
          error:
            "This file matches an existing certificate for a different record. Confirm that this is intentional and provide a reason.",
          duplicateFileWarning: true,
        },
        { status: 409 },
      );
    }
    const stored = await uploadCertificate(file, session, type, studentId);
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
              duplicateFileMatches: sameHash.docs.map((doc) => doc.id),
            }),
      });
    } catch (error) {
      await removeCertificateNumberIndex(ref.id).catch(() =>
        console.error("Certificate number index cleanup failed"),
      );
      await softDeleteR2Object(stored.r2Key, studentId).catch(() =>
        console.error("Orphan R2 object cleanup failed"),
      );
      if (error instanceof DuplicateCertificateNumberError) {
        return NextResponse.json(
          { error: "That certificate number is already assigned." },
          { status: 409 },
        );
      }
      console.error("Certificate metadata persistence failed");
      throw error;
    }
    await writeAuditLog(
      request,
      admin.uid,
      "certificate.upload",
      ref.id,
      studentId,
    );
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
  } catch (error) {
    return apiError(error);
  }
}
