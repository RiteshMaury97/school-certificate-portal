import { createHmac } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db, describeFirebaseError } from "@/server/firebase-admin";
import {
  adminSessionCookieOptions,
  csrfCookieOptions,
  apiError,
  requireAdmin,
  writeAuditLog,
} from "@/server/security";
import { isAdminSessionExpired } from "@/shared/session-policy";

import type { DocumentSnapshot, QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
export const runtime = "nodejs";

function timestampMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof value.toMillis === "function"
  )
    return value.toMillis();
  return 0;
}

async function listRecentByUid(
  collection: "adminSessions" | "adminDevices",
  uid: string,
  timestampField: "createdAt" | "lastSeenAt",
): Promise<QueryDocumentSnapshot[]> {
  try {
    const snapshot = await db
      .collection(collection)
      .where("uid", "==", uid)
      .orderBy(timestampField, "desc")
      .limit(30)
      .get();
    return snapshot.docs;
  } catch (error) {
    const code = (error as { code?: unknown } | null)?.code;
    if (
      code !== 9 &&
      code !== "9" &&
      code !== "failed-precondition" &&
      code !== "FAILED_PRECONDITION"
    )
      throw error;

    // The ordered query requires a deployed composite index. Keep the panel
    // usable during index rollout by sorting this administrator's rows here.
    console.warn(
      `[admin/sessions] Falling back to in-memory ${collection} sort: ${describeFirebaseError(error)}`,
    );
    const snapshot = await db.collection(collection).where("uid", "==", uid).get();
    return snapshot.docs
      .sort(
        (left: DocumentSnapshot, right: DocumentSnapshot) =>
          timestampMillis(right.get(timestampField)) - timestampMillis(left.get(timestampField)),
      )
      .slice(0, 30);
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    const [sessions, devices] = await Promise.all([
      listRecentByUid("adminSessions", admin.uid, "createdAt"),
      listRecentByUid("adminDevices", admin.uid, "lastSeenAt"),
    ]);
    const cookie = request.cookies.get("sis_admin_session")?.value ?? "";
    const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
    const currentHash =
      cookie && Buffer.byteLength(secret) >= 32
        ? createHmac("sha256", secret).update(cookie).digest("hex")
        : "";
    return NextResponse.json(
      {
        sessions: sessions.map((d) => ({
          sessionId: d.get("sessionId"),
          browser: d.get("browser"),
          city: d.get("city"),
          country: d.get("country"),
          createdAt: d.get("createdAt")?.toDate?.()?.toISOString?.() ?? null,
          lastActivityAt: d.get("lastActivityAt")?.toDate?.()?.toISOString?.() ?? null,
          current: d.id === currentHash,
          revoked:
            Boolean(d.get("revokedAt")) ||
            isAdminSessionExpired(
              d.get("lastActivityAt")?.toDate?.()?.getTime?.() ?? 0,
              d.get("absoluteExpiresAt")?.toDate?.()?.getTime?.() ?? 0,
            ),
        })),
        recentLogins: devices.map((d) => ({
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
    console.error("[admin/sessions GET]", describeFirebaseError(e));
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
    if (snap.empty) return NextResponse.json({ error: "Session not found." }, { status: 404 });
    await snap.docs[0]!.ref.set(
      { revokedAt: FieldValue.serverTimestamp(), revokeReason: "user_revoked" },
      { merge: true },
    );
    await writeAuditLog(request, admin.uid, "admin.session_revoke", body.sessionId);
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
