import { NextResponse } from "next/server";

import { adminAuth, db, describeFirebaseError } from "@/server/firebase-admin";
import { sameOrigin, verifyRequestAppCheck, writeAuditLog } from "@/server/security";
import { readErrorCode } from "@/shared/safe-values";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });

    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer "))
      return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });

    const decoded = await adminAuth.verifyIdToken(authorization.slice(7), true);
    if (Date.now() / 1000 - decoded.auth_time > 10 * 60)
      return NextResponse.json(
        { error: "Your temporary sign-in expired. Sign in again." },
        { status: 401 },
      );

    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("newPassword" in body) ||
      typeof body.newPassword !== "string" ||
      body.newPassword.length < 12 ||
      body.newPassword.length > 128
    )
      return NextResponse.json(
        { error: "Choose a password between 12 and 128 characters." },
        { status: 400 },
      );

    const userRef = db.collection("admins").doc(decoded.uid);
    const admin = await userRef.get();
    const role = admin.get("role");
    const email = decoded.email?.toLowerCase() ?? "";
    if (
      !decoded.email_verified ||
      !admin.exists ||
      admin.get("mustChangePassword") !== true ||
      decoded.mustChangePassword !== true ||
      !email ||
      admin.get("email")?.toLowerCase() !== email ||
      decoded.role !== role ||
      !["active", "invited"].includes(String(admin.get("status")))
    )
      return NextResponse.json(
        { error: "This password change is not authorized." },
        { status: 403 },
      );

    await adminAuth.updateUser(decoded.uid, { password: body.newPassword });
    const user = await adminAuth.getUser(decoded.uid);
    const claims = { ...user.customClaims };
    delete claims.mustChangePassword;
    await adminAuth.setCustomUserClaims(decoded.uid, claims);
    await userRef.update({ mustChangePassword: false, passwordChangedAt: new Date() });
    await writeAuditLog(request, decoded.uid, "admin.temporary_password_changed", decoded.uid);

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = readErrorCode(error);
    if (
      error instanceof Error &&
      (error.message === "APP_CHECK" || error.message === "Invalid origin")
    )
      return NextResponse.json(
        { error: "Sign-in verification failed. Reload and try again." },
        { status: 403 },
      );
    if (code.startsWith("auth/"))
      return NextResponse.json(
        { error: "Your sign-in has expired. Sign in again." },
        { status: 401 },
      );
    console.error("[admin/credentials/change-temporary-password]", describeFirebaseError(error));
    return NextResponse.json(
      { error: "Unable to change your password right now." },
      { status: 500 },
    );
  }
}
