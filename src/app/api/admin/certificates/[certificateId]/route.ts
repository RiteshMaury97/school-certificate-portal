import { duplicateFileDecision } from "@/shared/certificate-lifecycle";
import { encryptCertificateNumber } from "@/server/certificate-number";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { db } from "@/server/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  uploadCertificate,
  softDeleteR2Object,
  certificateTypeSlug,
} from "@/server/r2";
import { certificateMetadataSchema } from "@/shared/validation";
import {
  requireRoles,
  requireSensitiveReauth,
  writeAuditLog,
  apiError,
} from "@/server/security";
import {
  createCertificateNumberIndex,
  replaceCertificateNumberIndex,
  DuplicateCertificateNumberError,
  removeCertificateNumberIndex,
} from "@/server/certificate-index";
import { canReplacePublishedCertificate } from "@/shared/certificate-lifecycle";
import {
  ensurePublicSessions,
  rebuildPublicSessions,
} from "@/server/public-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    const admin = await requireRoles(request, ["approver"]);
    const { certificateId } = await context.params;
    const parsed = certificateMetadataSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid certificate metadata." },
        { status: 400 },
      );
    const { session, type } = parsed.data;
    const [sessionDoc, typeDoc] = await Promise.all([
      db.collection("sessions").doc(session).get(),
      db.collection("certificateTypes").doc(certificateTypeSlug(type)).get(),
    ]);
    if (!sessionDoc.exists || !typeDoc.exists)
      return NextResponse.json(
        { error: "Unknown session or certificate type." },
        { status: 400 },
      );
    const ref = db.collection("certificates").doc(certificateId);
    const current = await ref.get();
    if (!current.exists)
      return NextResponse.json(
        { error: "Certificate not found." },
        { status: 404 },
      );
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
          error:
            "Changing session or certificate type requires uploading the premade file again.",
        },
        { status: 400 },
      );
    }
    try {
      await replaceCertificateNumberIndex(
        parsed.data.certificateNumber,
        certificateId,
        session,
      );
    } catch (error) {
      if (error instanceof DuplicateCertificateNumberError) {
        return NextResponse.json(
          { error: "That certificate number is already assigned." },
          { status: 409 },
        );
      }
      throw error;
    }
    const { certificateNumber: _number, ...metadata } = parsed.data;
    await ref.update({
      ...metadata,
      certificateNumberEncrypted: encryptCertificateNumber(
        parsed.data.certificateNumber,
      ),
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
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    const admin = await requireRoles(request, ["uploader"]);
    const { certificateId } = await context.params;
    const oldRef = db.collection("certificates").doc(certificateId);
    const current = await oldRef.get();
    if (
      !current.exists ||
      !canReplacePublishedCertificate(current.get("status"))
    )
      return NextResponse.json(
        { error: "Only a published certificate can be replaced." },
        { status: 409 },
      );
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json(
        { error: "Select a replacement file." },
        { status: 400 },
      );
    const parsed = certificateMetadataSchema.safeParse({
      session: String(form.get("session") ?? current.get("session")),
      type: String(form.get("type") ?? current.get("type")),
      certificateNumber: String(form.get("certificateNumber") ?? ""),
      issueDate: String(form.get("issueDate") ?? current.get("issueDate")),
    });
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid replacement metadata." },
        { status: 400 },
      );
    const [sessionDoc, typeDoc] = await Promise.all([
      db.collection("sessions").doc(parsed.data.session).get(),
      db
        .collection("certificateTypes")
        .doc(certificateTypeSlug(parsed.data.type))
        .get(),
    ]);
    if (!sessionDoc.exists || !typeDoc.exists)
      return NextResponse.json(
        { error: "Unknown session or certificate type." },
        { status: 400 },
      );
    const hash = createHash("sha256")
      .update(Buffer.from(await file.arrayBuffer()))
      .digest("hex");
    const sameHash = await db
      .collection("certificates")
      .where("sha256", "==", hash)
      .get();
    const studentId = String(current.get("studentId") ?? "");
    const duplicateDecision = duplicateFileDecision(
      sameHash.docs.map((doc) => ({
        studentId: doc.get("studentId"),
        type: doc.get("type"),
      })),
      studentId,
      parsed.data.type,
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
    )
      return NextResponse.json(
        {
          error:
            "This file matches another certificate. Confirm this is intentional and provide a reason.",
          duplicateFileWarning: true,
        },
        { status: 409 },
      );
    const stored = await uploadCertificate(
      file,
      parsed.data.session,
      parsed.data.type,
      studentId,
    );
    const replacementRef = db.collection("certificates").doc(randomUUID());
    try {
      await createCertificateNumberIndex(
        parsed.data.certificateNumber,
        replacementRef.id,
        parsed.data.session,
      );
      await replacementRef.set({
        publicId: randomUUID().replace(/-/g, ""),
        studentId: current.get("studentId"),
        session: parsed.data.session,
        type: parsed.data.type,
        certificateNumberEncrypted: encryptCertificateNumber(
          parsed.data.certificateNumber,
        ),
        r2Key: stored.r2Key,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        size: stored.size,
        sha256: stored.sha256,
        issueDate: parsed.data.issueDate,
        status: "pending",
        published: false,
        uploadedBy: admin.uid,
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
    } catch (error) {
      await removeCertificateNumberIndex(replacementRef.id).catch(
        () => undefined,
      );
      await softDeleteR2Object(stored.r2Key, studentId).catch(() => undefined);
      if (error instanceof DuplicateCertificateNumberError)
        return NextResponse.json(
          { error: "That certificate number is already assigned." },
          { status: 409 },
        );
      throw error;
    }
    await writeAuditLog(
      request,
      admin.uid,
      "certificate.reissue.uploaded",
      replacementRef.id,
      String(current.get("studentId") ?? ""),
    );
    return NextResponse.json(
      { ok: true, replacementId: replacementRef.id, status: "pending" },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
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
    if (!doc.exists)
      return NextResponse.json(
        { error: "Certificate not found." },
        { status: 404 },
      );
    if (doc.get("status") === "published") await ensurePublicSessions();
    const r2Key = String(doc.get("r2Key") ?? "");
    if (r2Key)
      await softDeleteR2Object(r2Key, String(doc.get("studentId") ?? ""));
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
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
