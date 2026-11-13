import { randomBytes, createHmac } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { consumeVerifiedAdminOtpChallenge } from "@/server/admin-otp";
import { db } from "@/server/firebase-admin";
import { requireAdmin, sameOrigin, verifyCsrf, writeAuditLog } from "@/server/security";

import type { NextRequest } from "next/server";

type ReauthBody = { challengeId: string };

function isReauthBody(value: unknown): value is ReauthBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "challengeId" in value &&
    typeof value.challengeId === "string" &&
    /^[0-9a-f-]{36}$/i.test(value.challengeId)
  );
}

async function consumeChallenge(challengeId: string, uid: string): Promise<boolean> {
  const ref = db.collection("adminOtpChallenges").doc(challengeId);
  return db.runTransaction((transaction) =>
    consumeVerifiedAdminOtpChallenge(transaction, ref, uid),
  );
}

async function issueReauthGrant(uid: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  if (Buffer.byteLength(secret) < 32) throw new Error("Missing audit secret");
  const hash = createHmac("sha256", secret).update(token).digest("hex");
  await db.collection("adminReauthGrants").doc(hash).create({
    uid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: new Date(Date.now() + 5 * 60_000),
    usedAt: null,
  });
  return token;
}

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request) || !verifyCsrf(request))
      return NextResponse.json({ error: "CSRF validation failed." }, { status: 403 });
    const admin = await requireAdmin(request);
    const body: unknown = await request.json();
    if (!isReauthBody(body))
      return NextResponse.json({ error: "A verified email code is required." }, { status: 400 });
    const record = await db.collection("admins").doc(admin.uid).get();
    const email = String(record.get("email") ?? "").trim().toLowerCase();
    if (
      !record.exists ||
      record.get("status") !== "active" ||
      email !== admin.email.trim().toLowerCase() ||
      record.get("role") !== admin.role
    )
      return NextResponse.json({ error: "Re-authentication could not be verified." }, { status: 403 });
    const consumed = await consumeChallenge(body.challengeId, admin.uid);
    if (!consumed)
      return NextResponse.json({ error: "Email verification is missing or expired." }, { status: 403 });
    const token = await issueReauthGrant(admin.uid);
    await writeAuditLog(request, admin.uid, "admin.reauth", "security");
    return NextResponse.json({ grant: token }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Re-authentication could not be verified." }, { status: 403 });
  }
}
