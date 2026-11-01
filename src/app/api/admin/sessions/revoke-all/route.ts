import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { adminAuth, db } from "@/server/firebase-admin";
import {
  adminSessionCookieOptions,
  csrfCookieOptions,
  apiError,
  requireAdmin,
  writeAuditLog,
} from "@/server/security";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    await adminAuth.revokeRefreshTokens(admin.uid);
    const snap = await db
      .collection("adminSessions")
      .where("uid", "==", admin.uid)
      .get();
    const batch = db.batch();
    for (const doc of snap.docs) batch.set(
        doc.ref,
        {
          revokedAt: FieldValue.serverTimestamp(),
          revokeReason: "sign_out_all_devices",
        },
        { merge: true },
      )
    ;
    if (!snap.empty) await batch.commit();
    await writeAuditLog(
      request,
      admin.uid,
      "admin.sign_out_all_devices",
      "all_sessions",
    );
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
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
  } catch (e) {
    return apiError(e);
  }
}
