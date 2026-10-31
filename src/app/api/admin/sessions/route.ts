import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/server/firebase-admin";
import {
  adminSessionCookieOptions,
  csrfCookieOptions,
  apiError,
  requireAdmin,
  writeAuditLog,
} from "@/server/security";
import { isAdminSessionExpired } from "@/shared/session-policy";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const snap = await db
      .collection("adminSessions")
      .where("uid", "==", admin.uid)
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();
    const recent = await db
      .collection("adminDevices")
      .where("uid", "==", admin.uid)
      .orderBy("lastSeenAt", "desc")
      .limit(30)
      .get();
    const cookie = request.cookies.get("sis_admin_session")?.value ?? "";
    const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
    const currentHash =
      cookie && Buffer.byteLength(secret) >= 32
        ? createHmac("sha256", secret).update(cookie).digest("hex")
        : "";
    return NextResponse.json(
      {
        sessions: snap.docs.map((d) => ({
          sessionId: d.get("sessionId"),
          browser: d.get("browser"),
          city: d.get("city"),
          country: d.get("country"),
          createdAt: d.get("createdAt")?.toDate?.()?.toISOString?.() ?? null,
          lastActivityAt:
            d.get("lastActivityAt")?.toDate?.()?.toISOString?.() ?? null,
          current: d.id === currentHash,
          revoked:
            Boolean(d.get("revokedAt")) ||
            isAdminSessionExpired(
              d.get("lastActivityAt")?.toDate?.()?.getTime?.() ?? 0,
              d.get("absoluteExpiresAt")?.toDate?.()?.getTime?.() ?? 0,
            ),
        })),
        recentLogins: recent.docs.map((d) => ({
          browser: d.get("browser"),
          city: d.get("city"),
          country: d.get("country"),
          createdAt: d.get("createdAt")?.toDate?.()?.toISOString?.() ?? null,
          lastSeenAt: d.get("lastSeenAt")?.toDate?.()?.toISOString?.() ?? null,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const body = (await request.json()) as { sessionId?: unknown };
    if (typeof body.sessionId !== "string")
      return NextResponse.json({ error: "Choose a session." }, { status: 400 });
    const snap = await db
      .collection("adminSessions")
      .where("uid", "==", admin.uid)
      .where("sessionId", "==", body.sessionId)
      .limit(1)
      .get();
    if (snap.empty)
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 },
      );
    await snap.docs[0]!.ref.set(
      { revokedAt: FieldValue.serverTimestamp(), revokeReason: "user_revoked" },
      { merge: true },
    );
    await writeAuditLog(
      request,
      admin.uid,
      "admin.session_revoke",
      body.sessionId,
    );
    const cookie = request.cookies.get("sis_admin_session")?.value ?? "";
    const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
    const currentHash =
      cookie && Buffer.byteLength(secret) >= 32
        ? createHmac("sha256", secret).update(cookie).digest("hex")
        : "";
    const response = NextResponse.json({ ok: true });
    if (snap.docs[0]!.id === currentHash) {
      response.cookies.set("sis_admin_session", "", {
        ...adminSessionCookieOptions(),
        maxAge: 0,
      });
      response.cookies.set("sis_admin_csrf", "", {
        ...csrfCookieOptions(),
        maxAge: 0,
      });
    }
    return response;
  } catch (e) {
    return apiError(e);
  }
}
