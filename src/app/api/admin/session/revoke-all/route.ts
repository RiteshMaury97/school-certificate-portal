import { createHmac } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { formString } from "@/app/api/_lib/form-data";
import { adminAuth, db } from "@/server/firebase-admin";
import {
  adminSessionCookieOptions,
  csrfCookieOptions,
  writeAuditLog,
} from "@/server/security";
import { absoluteUrl, getAllowedOrigins } from "@/server/site-origin";
import { isAllowedRequestOrigin } from "@/shared/origin-policy";

import type { NextRequest} from "next/server";

function toEpochMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  return value instanceof Timestamp ? value.toMillis() : null;
}

export const runtime = "nodejs";
const tokenRef = (token: string) => {
  const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  if (Buffer.byteLength(secret) < 32) throw new Error("Missing audit secret");
  return db
    .collection("adminSessionActions")
    .doc(createHmac("sha256", secret).update(token).digest("hex"));
};
async function consume(token: string) {
  const ref = tokenRef(token);
  let uid = "";
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const expiresAt: unknown = snap.get("expiresAt");
    const expires = toEpochMillis(expiresAt) ?? 0;
    const value: unknown = snap.get("uid");
    if (
      !snap.exists ||
      typeof value !== "string" ||
      snap.get("usedAt") ||
      Date.now() > expires
    )
      throw new Error("TOKEN_INVALID");
    uid = value;
    tx.update(ref, { usedAt: FieldValue.serverTimestamp() });
  });
  return uid;
}
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  if (token.length < 32)
    return NextResponse.redirect(
      absoluteUrl("/admin/login?security=invalid"),
      303,
    );
  try {
    const ref = tokenRef(token);
    const snap = await ref.get();
    const expiresAt: unknown = snap.get("expiresAt");
    const expires = toEpochMillis(expiresAt) ?? 0;
    if (!snap.exists || snap.get("usedAt") || Date.now() > expires)
      return NextResponse.redirect(
        absoluteUrl("/admin/login?security=expired"),
        303,
      );
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirm sign out</title><main><h1>Sign out of all admin devices?</h1><p>This will revoke every active administrator session for your account.</p><form method="post"><input type="hidden" name="token" value="${token.replace(/[^A-Za-z0-9_-]/g, "")}"><button type="submit">Sign out everywhere</button></form></main></html>`;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return NextResponse.redirect(
      absoluteUrl("/admin/login?security=error"),
      303,
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (
      !isAllowedRequestOrigin(
        origin,
        getAllowedOrigins(),
        process.env.NODE_ENV !== "production",
      )
    ) {
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    }
    const form = await request.formData();
    const token = formString(form, "token");
    if (token.length < 32)
      return NextResponse.redirect(
        absoluteUrl("/admin/login?security=invalid"),
        303,
      );
    const uid = await consume(token);
    await adminAuth.revokeRefreshTokens(uid);
    const sessions = await db
      .collection("adminSessions")
      .where("uid", "==", uid)
      .get();
    const batch = db.batch();
    for (const doc of sessions.docs) batch.set(
        doc.ref,
        {
          revokedAt: FieldValue.serverTimestamp(),
          revokeReason: "email_security_link",
        },
        { merge: true },
      )
    ;
    if (!sessions.empty) await batch.commit();
    await writeAuditLog(
      request,
      uid,
      "admin.sign_out_all_devices",
      "email_security_link",
    );
    const response = NextResponse.redirect(
      absoluteUrl("/admin/login?security=signed-out"),
      303,
    );
    response.cookies.set("sis_admin_session", "", {
      ...adminSessionCookieOptions(),
      maxAge: 0,
    });
    response.cookies.set("sis_admin_csrf", "", {
      ...csrfCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.redirect(
      absoluteUrl("/admin/login?security=error"),
      303,
    );
  }
}
