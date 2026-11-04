import { NextResponse } from "next/server";

import { adminAuth, db, describeFirebaseError } from "@/server/firebase-admin";
import { sameOrigin, verifyRequestAppCheck, writeAuditLog } from "@/server/security";
import { readErrorCode } from "@/shared/safe-values";

import type { NextRequest } from "next/server";

function hasValidNewPassword(value: unknown): value is { newPassword: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "newPassword" in value &&
    typeof value.newPassword === "string" &&
    value.newPassword.length >= 12 &&
    value.newPassword.length <= 128
  );
}

function isAuthorizedPasswordChange(input: {
  emailVerified: boolean;
  storedEmail: unknown;
  role: unknown;
  decodedRole: unknown;
  adminExists: boolean;
  mustChangePassword: unknown;
  decodedMustChangePassword: unknown;
  status: unknown;
  email: string;
}): boolean {
  const activeStatus = input.status === "active" || input.status === "invited";
  return (
    input.emailVerified &&
    input.adminExists &&
    input.mustChangePassword === true &&
    input.decodedMustChangePassword === true &&
    input.email.length > 0 &&
    typeof input.storedEmail === "string" &&
    input.storedEmail.toLowerCase() === input.email &&
    input.decodedRole === input.role &&
    activeStatus
  );
}

function passwordChangeError(error: unknown): NextResponse {
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
    if (!hasValidNewPassword(body))
      return NextResponse.json(
        { error: "Choose a password between 12 and 128 characters." },
        { status: 400 },
      );

    const userRef = db.collection("admins").doc(decoded.uid);
    const admin = await userRef.get();
    const role: unknown = admin.get("role");
    const storedEmail: unknown = admin.get("email");
    const status: unknown = admin.get("status");
    const mustChangePassword: unknown = admin.get("mustChangePassword");
    const email = decoded.email?.toLowerCase() ?? "";
    if (!isAuthorizedPasswordChange({
      emailVerified: decoded.email_verified,
      storedEmail,
      role,
      decodedRole: decoded.role,
      adminExists: admin.exists,
      mustChangePassword,
      decodedMustChangePassword: decoded.mustChangePassword,
      status,
      email,
    }))
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
    return passwordChangeError(error);
  }
}
