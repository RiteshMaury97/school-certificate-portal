import { createHmac } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
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
import type { NextRequest} from "next/server";
export const runtime = "nodejs";

function timestampMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (value instanceof Timestamp) return value.toMillis();
  return 0;
}

function documentValue(document: DocumentSnapshot, field: string): unknown {
  const value: unknown = document.get(field);
  return value;
}

function documentTimestamp(document: DocumentSnapshot, field: string): string | null {
  const value = documentValue(document, field);
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function isRevoked(document: DocumentSnapshot): boolean {
  return (
    Boolean(documentValue(document, "revokedAt")) ||
    isAdminSessionExpired(
      timestampMillis(documentValue(document, "lastActivityAt")),
      timestampMillis(documentValue(document, "absoluteExpiresAt")),
    )
  );
}

function sessionDetails(document: DocumentSnapshot, currentHash: string) {
  return {
    sessionId: documentValue(document, "sessionId"),
    browser: documentValue(document, "browser"),
    city: documentValue(document, "city"),
    country: documentValue(document, "country"),
    createdAt: documentTimestamp(document, "createdAt"),
    lastActivityAt: documentTimestamp(document, "lastActivityAt"),
    current: document.id === currentHash,
    revoked: isRevoked(document),
  };
}

function deviceDetails(document: DocumentSnapshot) {
  return {
    browser: documentValue(document, "browser"),
    city: documentValue(document, "city"),
    country: documentValue(document, "country"),
    createdAt: documentTimestamp(document, "createdAt"),
    lastSeenAt: documentTimestamp(document, "lastSeenAt"),
  };
}

function currentSessionHash(request: NextRequest): string {
  const cookie = request.cookies.get("sis_admin_session")?.value ?? "";
  const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  return cookie && Buffer.byteLength(secret) >= 32
    ? createHmac("sha256", secret).update(cookie).digest("hex")
    : "";
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
    const code =
      typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
    if (code !== 9 && code !== "9" && code !== "failed-precondition" && code !== "FAILED_PRECONDITION") throw error;

    // The ordered query requires a deployed composite index. Keep the panel
    // usable during index rollout by sorting this administrator's rows here.
    console.warn(`[admin/sessions] Falling back to in-memory ${collection} sort: ${describeFirebaseError(error)}`);
    const snapshot = await db.collection(collection).where("uid", "==", uid).get();
    return snapshot.docs
      .sort((left: DocumentSnapshot, right: DocumentSnapshot) =>
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
    const currentHash = currentSessionHash(request);
    return NextResponse.json(
      {
        sessions: sessions.map((document) => sessionDetails(document, currentHash)),
        recentLogins: devices.map(deviceDetails),
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
    const rawBody: unknown = await request.json();
    const body =
      typeof rawBody === "object" && rawBody !== null
        ? rawBody
        : {};
    if (!("sessionId" in body) || typeof body.sessionId !== "string")
      return NextResponse.json({ error: "Choose a session." }, { status: 400 });
    const snap = await db
      .collection("adminSessions")
      .where("uid", "==", admin.uid)
      .where("sessionId", "==", body.sessionId)
      .limit(1)
      .get();
    const session = snap.docs[0];
    if (!session)
      return NextResponse.json(
        { error: "Session not found." },
        { status: 404 },
      );
    await session.ref.set(
      { revokedAt: FieldValue.serverTimestamp(), revokeReason: "user_revoked" },
      { merge: true },
    );
    await writeAuditLog(
      request,
      admin.uid,
      "admin.session_revoke",
      body.sessionId,
    );
    const currentHash = currentSessionHash(request);
    const response = NextResponse.json({ ok: true });
    if (session.id === currentHash) {
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
