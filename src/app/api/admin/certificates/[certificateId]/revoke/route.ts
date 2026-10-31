import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import {
  adjustPublicSessions,
  ensurePublicSessions,
  rebuildPublicSessions,
} from "@/server/public-sessions";
import {
  requireRoles,
  requireSensitiveReauth,
  writeAuditLog,
  apiError,
} from "@/server/security";

import type { NextRequest} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    const admin = await requireRoles(request, ["approver"]);
    await requireSensitiveReauth(request, admin);
    const { certificateId } = await context.params;
    const body: unknown = await request.json().catch(() => null);
    const reason =
      body && typeof body === "object" && "reason" in body
        ? String(body.reason ?? "").trim()
        : "";
    if (reason.length < 5 || reason.length > 1000)
      return NextResponse.json(
        {
          error: "A revocation reason of at least five characters is required.",
        },
        { status: 400 },
      );
    await ensurePublicSessions();
    const ref = db.collection("certificates").doc(certificateId);
    const result = await db.runTransaction(async (tx) => {
      const certificate = await tx.get(ref);
      if (!certificate.exists) throw new Error("NOT_FOUND");
      if (certificate.get("status") !== "published")
        throw new Error("NOT_PUBLISHED");
      tx.update(ref, {
        status: "revoked",
        published: false,
        revokedAt: FieldValue.serverTimestamp(),
        revokedBy: admin.uid,
        revocationReason: reason,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: admin.uid,
      });
      return {
        studentId: String(certificate.get("studentId") ?? ""),
        session: String(certificate.get("session") ?? ""),
      };
    });
    await adjustPublicSessions([{ session: result.session, delta: -1 }]).catch(
      async () => rebuildPublicSessions(),
    );
    await writeAuditLog(
      request,
      admin.uid,
      "certificate.revoked",
      certificateId,
      result.studentId,
    );
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND")
      return NextResponse.json(
        { error: "Certificate not found." },
        { status: 404 },
      );
    if (error instanceof Error && error.message === "NOT_PUBLISHED")
      return NextResponse.json(
        { error: "Only published certificates can be revoked." },
        { status: 409 },
      );
    return apiError(error);
  }
}
