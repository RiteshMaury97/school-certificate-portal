import { randomBytes, createHmac } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { consumeVerifiedAdminOtpChallenge } from "@/server/admin-otp";
import { adminAuth, db } from "@/server/firebase-admin";
import {
  requireAdmin,
  sameOrigin,
  verifyRequestAppCheck,
  verifyCsrf,
  writeAuditLog,
} from "@/server/security";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    if (!sameOrigin(request) || !verifyCsrf(request))
      return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
    const admin = await requireAdmin(request);
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("idToken" in body) ||
      typeof body.idToken !== "string" ||
      !("challengeId" in body) ||
      typeof body.challengeId !== "string"
    ) {
      return NextResponse.json(
        { error: "Recent password and email-code verification are required." },
        { status: 400 },
      );
    }
    const decoded = await adminAuth.verifyIdToken(body.idToken, true);
    const authTime = Number(decoded.auth_time ?? 0);
    const ageSeconds = Date.now() / 1000 - authTime;
    const adminRecord = await db.collection("admins").doc(decoded.uid).get();
    const storedRole = adminRecord.get("role");
    const storedEmail = String(adminRecord.get("email") ?? "")
      .trim()
      .toLowerCase();
    if (
      decoded.uid !== admin.uid ||
      !Number.isFinite(authTime) ||
      ageSeconds < 0 ||
      ageSeconds > 300 ||
      !decoded.email_verified ||
      !adminRecord.exists ||
      adminRecord.get("status") !== "active" ||
      storedEmail !==
        String(decoded.email ?? "")
          .trim()
          .toLowerCase() ||
      decoded.role !== storedRole
    ) {
      return NextResponse.json(
        { error: "Recent password and email-code verification are required." },
        { status: 403 },
      );
    }
    const challengeRef = db.collection("adminOtpChallenges").doc(body.challengeId);
    const consumed = await db.runTransaction((transaction) =>
      consumeVerifiedAdminOtpChallenge(transaction, challengeRef, admin.uid),
    );
    if (!consumed)
      return NextResponse.json(
        { error: "Email verification is missing or expired." },
        { status: 403 },
      );
    const token = randomBytes(32).toString("base64url");
    const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
    if (Buffer.byteLength(secret) < 32) throw new Error("Missing audit secret");
    const hash = createHmac("sha256", secret).update(token).digest("hex");
    await db
      .collection("adminReauthGrants")
      .doc(hash)
      .create({
        uid: admin.uid,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 5 * 60_000),
        usedAt: null,
      });
    await writeAuditLog(request, admin.uid, "admin.reauth", "security");
    return NextResponse.json({ grant: token }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Re-authentication could not be verified." },
      { status: 403 },
    );
  }
}
