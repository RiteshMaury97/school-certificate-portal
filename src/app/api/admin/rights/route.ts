import { NextResponse } from "next/server";

import { eraseStudentData } from "@/server/erasure";
import { db } from "@/server/firebase-admin";
import { sendMail } from "@/server/mailer";
import { requireRoles, requireSensitiveReauth, writeAuditLog, apiError } from "@/server/security";

import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
export const runtime = "nodejs";

async function getRequestsByStatus(status: string) {
  const collection = db.collection("dataRightsRequests");
  let docs: QueryDocumentSnapshot[];
  try {
    // Filter in Firestore, but avoid the status + createdAt composite index.
    docs = (await collection.where("status", "==", status).get()).docs;
  } catch (error) {
    const detail = error as { code?: string | number; message?: string };
    const message = detail.message ?? String(error);
    if (
      detail.code !== 9 &&
      detail.code !== "9" &&
      detail.code !== "failed-precondition" &&
      !message.includes("FAILED_PRECONDITION") &&
      !message.includes("requires an index")
    ) {
      throw error;
    }

    // If status indexing is also unavailable, preserve page availability by
    // filtering the collection in memory. This is an admin-only, bounded UI.
    docs = (await collection.get()).docs.filter((doc) => doc.get("status") === status);
  }

  const createdAtMillis = (value: unknown): number => {
    if (value && typeof value === "object" && "toMillis" in value) {
      const toMillis = (value as { toMillis?: () => number }).toMillis;
      if (typeof toMillis === "function") return toMillis.call(value);
    }
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string") return Date.parse(value) || 0;
    return 0;
  };

  return {
    docs: docs
      .sort((a, b) => createdAtMillis(b.get("createdAt")) - createdAtMillis(a.get("createdAt")))
      .slice(0, 200),
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["approver", "admin"]);
    const status = request.nextUrl.searchParams.get("status") ?? "open";
    if (!["open", "resolved", "rejected"].includes(status))
      return NextResponse.json({ error: "Invalid request status." }, { status: 400 });
    const snap = await getRequestsByStatus(status);
    return NextResponse.json(
      { requests: snap.docs.map((d) => ({ id: d.id, ...d.data() })) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      id?: unknown;
      resolution?: unknown;
      action?: unknown;
      studentId?: unknown;
      reason?: unknown;
      confirm?: unknown;
    };
    if (body.action === "erase") {
      const admin = await requireRoles(request, ["superadmin"]);
      await requireSensitiveReauth(request, admin);
      if (
        typeof body.id !== "string" ||
        typeof body.studentId !== "string" ||
        body.confirm !== "ERASE" ||
        typeof body.reason !== "string" ||
        body.reason.trim().length < 10
      )
        return NextResponse.json(
          {
            error: "Select the verified student, type ERASE and provide a documented reason.",
          },
          { status: 400 },
        );
      const requestRef = db.collection("dataRightsRequests").doc(body.id);
      const requestSnapshot = await requestRef.get();
      const requesterEmail = String(requestSnapshot.get("contactEmail") ?? "");
      const result = await eraseStudentData(
        body.studentId,
        admin.uid,
        "data-principal-request",
        undefined,
        body.id,
        requesterEmail || undefined,
      );
      await writeAuditLog(
        request,
        admin.uid,
        "data_rights.erasure_complete",
        result.erasureId,
      ).catch(() => {});
      if (requesterEmail) {
        const siteSettings = await db.collection("siteSettings").doc("main").get();
        const schoolName =
          String(siteSettings.get("schoolName") ?? "").trim() || "Satyam International School";
        await sendMail({
          to: requesterEmail,
          subject: `${schoolName}: data erasure request completed`,
          text: `${schoolName}: your data erasure request ${body.id} has been completed. Reference receipt: ${result.erasureId}. Please contact the school if you need assistance.`,
        }).catch(() => {});
      }
      return NextResponse.json(
        {
          ok: true,
          acknowledgmentId: body.id,
          erasureId: result.erasureId,
          verified: result.verified,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const admin = await requireRoles(request, ["approver", "admin"]);
    if (
      typeof body.id !== "string" ||
      typeof body.resolution !== "string" ||
      body.resolution.trim().length < 1 ||
      body.resolution.length > 2000
    )
      return NextResponse.json(
        { error: "Request ID and resolution are required." },
        { status: 400 },
      );
    await db.collection("dataRightsRequests").doc(body.id).update({
      status: "resolved",
      resolution: body.resolution.trim(),
      resolvedBy: admin.uid,
      resolvedAt: new Date(),
    });
    await writeAuditLog(request, admin.uid, "data_rights.resolve", body.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
