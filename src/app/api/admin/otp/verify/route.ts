import { NextResponse } from "next/server";

import {
  adminOtpChallengeCollection,
  isAdminOtpLocked,
  recordAdminOtpFailure,
  verifyAdminOtpChallenge,
} from "@/server/admin-otp";
import { adminAuth, db } from "@/server/firebase-admin";
import {
  sameOrigin,
  verifyRequestAppCheck,
  writeAuditLog,
} from "@/server/security";

import type { NextRequest} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyBody = { idToken?: unknown; challengeId?: unknown; code?: unknown };
function validBody(value: unknown): value is VerifyBody & { idToken: string; challengeId: string; code: string } {
  return typeof value === "object" && value !== null &&
    "idToken" in value && typeof value.idToken === "string" &&
    "challengeId" in value && typeof value.challengeId === "string" &&
    /^[0-9a-f-]{36}$/i.test(value.challengeId) &&
    "code" in value && /^[0-9]{6}$/.test(String("code" in value ? value.code : ""));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await verifyRequestAppCheck(request);
    if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
    const body: unknown = await request.json();
    if (!validBody(body)) return NextResponse.json({ error: "The code is invalid or expired." }, { status: 400 });
    const decoded = await adminAuth.verifyIdToken(body.idToken, true);
    const email = decoded.email?.trim().toLowerCase() ?? "";
    const admin = await db.collection("admins").doc(decoded.uid).get();
    const role = admin.get("role");
    if (
      !decoded.email_verified || !email || !admin.exists ||
      admin.get("mustChangePassword") === true || decoded.mustChangePassword === true ||
      !["active", "invited"].includes(String(admin.get("status"))) ||
      String(admin.get("email") ?? "").trim().toLowerCase() !== email ||
      !["uploader", "approver", "admin", "superadmin"].includes(String(role)) ||
      decoded.role !== role
    ) return NextResponse.json({ error: "The code is invalid or expired." }, { status: 403 });
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

    if (result.valid) {
      await writeAuditLog(request, decoded.uid, "otp.verified", body.challengeId);
      return NextResponse.json({ verified: true }, { headers: { "Cache-Control": "no-store" } });
    }
    const failure = await recordAdminOtpFailure(email, request);
    await writeAuditLog(request, decoded.uid, "otp.failed", body.challengeId);
    if (failure.locked) await writeAuditLog(request, decoded.uid, "otp.locked", body.challengeId);
    return NextResponse.json({
      error: "The code is invalid or expired.",
      remainingAttempts: result.attemptsRemaining,
    }, { status: failure.locked ? 423 : 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "APP_CHECK") {
      return NextResponse.json({ error: "App verification failed." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unable to verify the code." }, { status: 401 });
  }
}
