import { NextResponse } from "next/server";

import { enforceAdminLocation } from "@/server/admin-location";
import {
  adminOtpChallengeCollection,
  isAdminOtpLocked,
  recordAdminOtpFailure,
  verifyAdminOtpChallenge,
} from "@/server/admin-otp";
import { adminAuth, db } from "@/server/firebase-admin";
import { requesterIp } from "@/server/request-origin";
import {
  assertVerifiedGoogleSignIn,
  requireAdmin,
  sameOrigin,
  verifyCsrf,
  verifyAppCheckUnlessGoogle,
  writeAuditLog,
} from "@/server/security";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyBody = { idToken?: unknown; session?: unknown; challengeId?: unknown; code?: unknown };
function validBody(value: unknown): value is VerifyBody & { challengeId: string; code: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    (("idToken" in value && typeof value.idToken === "string" && value.idToken.length > 0) ||
      ("session" in value && (value.session === true || value.session === "true"))) &&
    "challengeId" in value &&
    typeof value.challengeId === "string" &&
    /^[0-9a-f-]{36}$/i.test(value.challengeId) &&
    "code" in value &&
    /^[0-9]{6}$/.test(String("code" in value ? value.code : ""))
  );
}

function isVerifiedAdmin(input: {
  emailVerified: boolean;
  email: string;
  adminExists: boolean;
  storedEmail: unknown;
  storedMustChangePassword: unknown;
  decodedMustChangePassword: unknown;
  status: unknown;
  role: unknown;
  decodedRole: unknown;
}): boolean {
  const activeStatus = new Set(["active", "invited"]).has(String(input.status));
  const supportedRole = new Set(["uploader", "approver", "admin", "superadmin"]).has(
    String(input.role),
  );
  return (
    input.emailVerified &&
    input.email.length > 0 &&
    input.adminExists &&
    input.storedMustChangePassword !== true &&
    input.decodedMustChangePassword !== true &&
    activeStatus &&
    typeof input.storedEmail === "string" &&
    input.storedEmail.trim().toLowerCase() === input.email &&
    supportedRole &&
    input.decodedRole === input.role
  );
}

async function otpResultResponse(input: {
  result: { valid: boolean; attemptsRemaining: number };
  request: NextRequest;
  uid: string;
  email: string;
  challengeId: string;
}): Promise<NextResponse> {
  if (input.result.valid) {
    await writeAuditLog(input.request, input.uid, "otp.verified", input.challengeId);
    return NextResponse.json({ verified: true }, { headers: { "Cache-Control": "no-store" } });
  }
  const failure = await recordAdminOtpFailure(input.email, input.request);
  await writeAuditLog(input.request, input.uid, "otp.failed", input.challengeId);
  if (failure.locked)
    await writeAuditLog(input.request, input.uid, "otp.locked", input.challengeId);
  return NextResponse.json(
    {
      error: "The code is invalid or expired.",
      remainingAttempts: input.result.attemptsRemaining,
    },
    { status: failure.locked ? 423 : 400 },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!requesterIp(request))
      return NextResponse.json(
        { error: "Client network information is unavailable." },
        { status: 503 },
      );
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const body: unknown = await request.json();
    if (!validBody(body))
      return NextResponse.json({ error: "The code is invalid or expired." }, { status: 400 });
    const sessionFlow = body.session === true || body.session === "true";
    let uid: string;
    let email: string;
    let validAdmin: boolean;
    if (sessionFlow) {
      if (!verifyCsrf(request))
        return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
      const identity = await requireAdmin(request);
      uid = identity.uid;
      email = identity.email.trim().toLowerCase();
      const admin = await db.collection("admins").doc(uid).get();
      validAdmin = isVerifiedAdmin({
        emailVerified: true,
        email,
        adminExists: admin.exists,
        storedEmail: admin.get("email"),
        storedMustChangePassword: admin.get("mustChangePassword"),
        decodedMustChangePassword: false,
        status: admin.get("status"),
        role: admin.get("role"),
        decodedRole: identity.role,
      });
    } else {
      // Turnstile/App Check is required for email+password sign-ins; Google sign-ins skip it.
      const appCheck = await verifyAppCheckUnlessGoogle(request, body.idToken as string);
      const decoded = await adminAuth.verifyIdToken(body.idToken as string, true);
      if (appCheck.skipped) assertVerifiedGoogleSignIn(decoded);
      uid = decoded.uid;
      email = decoded.email?.trim().toLowerCase() ?? "";
      const admin = await db.collection("admins").doc(uid).get();
      validAdmin = isVerifiedAdmin({
        emailVerified: decoded.email_verified === true,
        email,
        adminExists: admin.exists,
        storedEmail: admin.get("email"),
        storedMustChangePassword: admin.get("mustChangePassword"),
        decodedMustChangePassword: decoded.mustChangePassword,
        status: admin.get("status"),
        role: admin.get("role"),
        decodedRole: decoded.role,
      });
    }
    if (!validAdmin)
      return NextResponse.json({ error: "The code is invalid or expired." }, { status: 403 });
    const location = await enforceAdminLocation({ request, adminUid: uid });
    if (!location.allowed)
      return NextResponse.json({ error: "The code is invalid or expired." }, { status: 403 });
    if (await isAdminOtpLocked(email)) {
      await writeAuditLog(request, uid, "otp.locked", body.challengeId);
      return NextResponse.json({ error: "The code is invalid or expired." }, { status: 423 });
    }

    const ref = adminOtpChallengeCollection().doc(body.challengeId);
    const result = await db.runTransaction((transaction) =>
      verifyAdminOtpChallenge(transaction, ref, {
        uid,
        challengeId: body.challengeId,
        code: body.code,
      }),
    );

    return await otpResultResponse({
      result,
      request,
      uid,
      email,
      challengeId: body.challengeId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "APP_CHECK") {
      return NextResponse.json({ error: "App verification failed." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to verify the code." }, { status: 401 });
  }
}
