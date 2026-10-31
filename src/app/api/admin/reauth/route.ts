import { randomBytes, createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, db } from "@/server/firebase-admin";
import {
  requireAdmin,
  verifyRequestAppCheck,
  verifyCsrf,
} from "@/server/security";
import { FieldValue } from "firebase-admin/firestore";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    if (!verifyCsrf(request))
      return NextResponse.json(
        { error: "CSRF validation failed." },
        { status: 403 },
      );
    const admin = await requireAdmin(request);
    const body = (await request.json()) as { idToken?: unknown };
    if (typeof body.idToken !== "string")
      return NextResponse.json(
        { error: "Complete password and MFA again." },
        { status: 400 },
      );
    const decoded = await adminAuth.verifyIdToken(body.idToken, true);
    const authTime = Number(decoded.auth_time ?? 0);
    const second = (
      decoded.firebase as { sign_in_second_factor?: string } | undefined
    )?.sign_in_second_factor;
    if (
      decoded.uid !== admin.uid ||
      Date.now() / 1000 - authTime > 300 ||
      second !== "totp"
    )
      return NextResponse.json(
        { error: "Recent password and MFA verification is required." },
        { status: 403 },
      );
    const token = randomBytes(32).toString("base64url"),
      secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
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
    return NextResponse.json(
      { grant: token },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Re-authentication could not be verified." },
      { status: 403 },
    );
  }
}
