import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { eraseStudentData } from "@/server/erasure";
import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import {
  apiError,
  requireRoles,
  requireSensitiveReauth,
  writeAuditLog,
} from "@/server/security";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";

/**
 * Use the composite index when deployed. If it is not available yet, read the
 * matching status documents and sort locally so retention review remains
 * usable while the index is being provisioned.
 */
async function getOrderedByStatus(
  collection: "retentionReview" | "erasureJobs",
  status: string,
  orderField: "flaggedAt" | "updatedAt",
  limit: number,
) {
  const ref = db.collection(collection);
  try {
    return await ref
      .where("status", "==", status)
      .orderBy(orderField, "desc")
      .limit(limit)
      .get();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("FAILED_PRECONDITION") && !message.includes("requires an index")) {
      throw error;
    }

    const snap = await ref.where("status", "==", status).get();
    const timestamp = (value: unknown): number => {
      if (value && typeof value === "object" && "toMillis" in value) {
        const toMillis = (value as { toMillis?: () => number }).toMillis;
        if (typeof toMillis === "function") return toMillis.call(value);
      }
      if (value instanceof Date) return value.getTime();
      if (typeof value === "string") return Date.parse(value) || 0;
      return 0;
    };
    const docs = snap.docs
      .sort((a, b) => timestamp(b.get(orderField)) - timestamp(a.get(orderField)))
      .slice(0, limit);
    return { docs };
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["superadmin"]);
    const snap = await getOrderedByStatus("retentionReview", "open", "flaggedAt", 300);
    const records = await Promise.all(
      snap.docs.map(async (d) => {
        const student = await db.collection("students").doc(d.id).get();
        return {
          id: d.id,
          status: d.get("status"),
          retentionExpiresAt:
            d.get("retentionExpiresAt")?.toDate?.()?.toISOString?.() ?? null,
          flaggedAt: d.get("flaggedAt")?.toDate?.()?.toISOString?.() ?? null,
          student: student.exists
            ? {
                studentName: student.get("studentName"),
                fatherName: student.get("fatherName"),
                motherName: student.get("motherName"),
                session: student.get("session"),
              }
            : null,
        };
      }),
    );
    const retrySnap = await getOrderedByStatus("erasureJobs", "retry_required", "updatedAt", 50);
    const staleStarted = await getOrderedByStatus("erasureJobs", "started", "updatedAt", 50);
    const stale = staleStarted.docs.filter(
      (d) =>
        Date.now() -
          (d.get("updatedAt")?.toDate?.()?.getTime?.() ?? Date.now()) >
        30 * 60_000,
    );
    await Promise.all(
      stale.map((d) =>
        d.ref.set(
          {
            status: "retry_required",
            lastErrorCode: "ERASURE_INTERRUPTED",
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        ),
      ),
    );
    const retryDocs = [...retrySnap.docs, ...stale];
    const retryJobs = retryDocs.map((d) => ({
      id: d.id,
      status: "retry_required",
      lastErrorCode: stale.some((item) => item.id === d.id)
        ? "ERASURE_INTERRUPTED"
        : d.get("lastErrorCode"),
      updatedAt: d.get("updatedAt")?.toDate?.()?.toISOString?.() ?? null,
    }));
    return NextResponse.json(
      { records, retryJobs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    const body = (await request.json()) as {
      studentId?: unknown;
      jobId?: unknown;
      action?: unknown;
      reason?: unknown;
      years?: unknown;
      confirm?: unknown;
    };
    if (typeof body.action !== "string")
      return NextResponse.json(
        { error: "Invalid retention review action." },
        { status: 400 },
      );
    if (body.action === "retry") {
      await requireSensitiveReauth(request, admin);
      if (typeof body.jobId !== "string")
        return NextResponse.json(
          { error: "Erasure job ID is required." },
          { status: 400 },
        );
      const job = await db.collection("erasureJobs").doc(body.jobId).get();
      const studentId = job.get("studentId"),
        reason = job.get("reason");
      if (
        !job.exists ||
        typeof studentId !== "string" ||
        (reason !== "retention" && reason !== "data-principal-request")
      )
        return NextResponse.json(
          { error: "Retryable erasure job not found." },
          { status: 404 },
        );
      const requestId =
        typeof job.get("dataRightsRequestId") === "string"
          ? (job.get("dataRightsRequestId") as string)
          : undefined;
      const requesterEmail =
        typeof job.get("requesterEmail") === "string"
          ? (job.get("requesterEmail") as string)
          : "";
      const result = await eraseStudentData(
        studentId,
        admin.uid,
        reason,
        body.jobId,
        requestId,
        requesterEmail || undefined,
      );
      if (requesterEmail && requestId) {
        const siteSettings = await db.collection("siteSettings").doc("main").get();
        const schoolName = String(siteSettings.get("schoolName") ?? "").trim() || "Satyam International School";
        await sendMail({ to: requesterEmail, subject: `${schoolName}: data erasure request completed`, text: `${schoolName}: your data erasure request ${requestId} has been completed. Reference receipt: ${result.erasureId}. Please contact the school if you need assistance.` }).catch(() => {});
      }
      await writeAuditLog(
        request,
        admin.uid,
        "student.erasure.retry",
        result.erasureId,
      ).catch(() => {});
      return NextResponse.json(
        { ok: true, ...result },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (typeof body.studentId !== "string")
      return NextResponse.json(
        { error: "Student record ID is required." },
        { status: 400 },
      );
    const studentId = body.studentId,
      studentRef = db.collection("students").doc(studentId),
      reviewRef = db.collection("retentionReview").doc(studentId);
    const review = await reviewRef.get();
    if (!review.exists || review.get("status") !== "open")
      return NextResponse.json(
        { error: "This retention review is no longer open." },
        { status: 409 },
      );
    if (body.action === "extend") {
      if (
        typeof body.reason !== "string" ||
        body.reason.trim().length < 10 ||
        typeof body.years !== "number" ||
        !Number.isInteger(body.years) ||
        body.years < 1 ||
        body.years > 30
      )
        return NextResponse.json(
          {
            error: "Provide a reason and an extension between 1 and 30 years.",
          },
          { status: 400 },
        );
      const current =
        review.get("retentionExpiresAt")?.toDate?.() ?? new Date();
      const next = new Date(current);
      next.setFullYear(next.getFullYear() + body.years);
      await studentRef.update({
        retentionExpiresAt: next,
        retentionExtensionReason: body.reason.trim(),
        retentionExtendedBy: admin.uid,
      });
      await reviewRef.set(
        {
          status: "extended",
          reviewedBy: admin.uid,
          reviewedAt: FieldValue.serverTimestamp(),
          reason: body.reason.trim(),
          newExpiry: next,
        },
        { merge: true },
      );
      await writeAuditLog(request, admin.uid, "retention.extend", studentId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "dismiss") {
      if (typeof body.reason !== "string" || body.reason.trim().length < 10)
        return NextResponse.json(
          { error: "A dismissal reason is required." },
          { status: 400 },
        );
      await reviewRef.set(
        {
          status: "dismissed",
          reviewedBy: admin.uid,
          reviewedAt: FieldValue.serverTimestamp(),
          reason: body.reason.trim(),
        },
        { merge: true },
      );
      await writeAuditLog(request, admin.uid, "retention.dismiss", studentId);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "erase") {
      await requireSensitiveReauth(request, admin);
      if (
        body.confirm !== "ERASE" ||
        typeof body.reason !== "string" ||
        body.reason.trim().length < 10
      )
        return NextResponse.json(
          { error: "Confirm erasure and provide a documented reason." },
          { status: 400 },
        );
      const result = await eraseStudentData(studentId, admin.uid, "retention");
      await writeAuditLog(
        request,
        admin.uid,
        "student.erasure.complete",
        result.erasureId,
      ).catch(() => {});
      return NextResponse.json(
        { ok: true, ...result },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Unsupported review action." },
      { status: 400 },
    );
  } catch (e) {
    return apiError(e);
  }
}
