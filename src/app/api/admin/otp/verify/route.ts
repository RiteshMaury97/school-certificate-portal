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
import { sameOrigin, verifyRequestAppCheck, writeAuditLog } from "@/server/security";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyBody = { idToken?: unknown; challengeId?: unknown; code?: unknown };
function validBody(
  value: unknown,
): value is VerifyBody & { idToken: string; challengeId: string; code: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "idToken" in value &&
    typeof value.idToken === "string" &&
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
    await verifyRequestAppCheck(request);
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const body: unknown = await request.json();
    if (!validBody(body))
      return NextResponse.json({ error: "The code is invalid or expired." }, { status: 400 });
    const decoded = await adminAuth.verifyIdToken(body.idToken, true);
    const email = decoded.email?.trim().toLowerCase() ?? "";
    const admin = await db.collection("admins").doc(decoded.uid).get();
    const role: unknown = admin.get("role");
    const storedEmail: unknown = admin.get("email");
    const storedMustChangePassword: unknown = admin.get("mustChangePassword");
    const status: unknown = admin.get("status");
    if (!isVerifiedAdmin({
      emailVerified: decoded.email_verified === true,
      email,
      adminExists: admin.exists,
      storedEmail,
      storedMustChangePassword,
      decodedMustChangePassword: decoded.mustChangePassword,
      status,
      role,
      decodedRole: decoded.role,
    }))
      return NextResponse.json({ error: "The code is invalid or expired." }, { status: 403 });
    const location = await enforceAdminLocation({ request, adminUid: decoded.uid });
    if (!location.allowed)
      return NextResponse.json({ error: "The code is invalid or expired." }, { status: 403 });
    if (await isAdminOtpLocked(email)) {
      await writeAuditLog(request, decoded.uid, "otp.locked", body.challengeId);
      return NextResponse.json({ error: "The code is invalid or expired." }, { status: 423 });
    }

    const ref = adminOtpChallengeCollection().doc(body.challengeId);
    const result = await db.runTransaction((transaction) =>
      verifyAdminOtpChallenge(transaction, ref, {
        uid: decoded.uid,
        challengeId: body.challengeId,
        code: body.code,
      }),
    );

    return await otpResultResponse({
      result,
      request,
      uid: decoded.uid,
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
