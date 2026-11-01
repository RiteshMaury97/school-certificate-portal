import { NextResponse } from "next/server";

import { enforceAdminLocation } from "@/server/admin-location";
import { adminAuth, db, describeFirebaseError } from "@/server/firebase-admin";
import { requesterIp } from "@/server/request-origin";
import { sameOrigin, verifyRequestAppCheck } from "@/server/security";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    if (!requesterIp(request))
      return NextResponse.json(
        { error: "Administrator verification is temporarily unavailable." },
        { status: 503 },
      );
    await verifyRequestAppCheck(request);
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer "))
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const decoded = await adminAuth.verifyIdToken(header.slice(7), true);
    const email = decoded.email?.toLowerCase() ?? "";
    const admin = await db.collection("admins").doc(decoded.uid).get();
    if (
      !email ||
      !admin.exists ||
      // "invited" accounts must be able to complete email verification on first sign-in.
      !["active", "invited"].includes(String(admin.get("status"))) ||
      admin.get("email")?.toLowerCase() !== email ||
      !["uploader", "approver", "admin", "superadmin"].includes(String(admin.get("role"))) ||
      decoded.role !== admin.get("role")
    )
      return NextResponse.json({ error: "This account is not authorized." }, { status: 403 });
    const location = await enforceAdminLocation({ request, adminUid: decoded.uid });
    if (!location.allowed)
      return NextResponse.json(
        { error: "This sign-in cannot be completed from your current network." },
        { status: 403 },
      );
    return NextResponse.json({ authorized: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const code = String((error as { code?: unknown } | null)?.code ?? "");
    if (error instanceof Error && error.message === "APP_CHECK") {
      return NextResponse.json(
        { error: "App verification failed. Reload the page and try again." },
        { status: 403 },
      );
    }
    if (code.startsWith("auth/")) {
      return NextResponse.json(
        { error: "Your Google sign-in session is invalid or expired. Sign in again." },
        { status: 401 },
      );
    }
    console.error("[admin/preflight POST]", describeFirebaseError(error));
    return NextResponse.json(
      { error: "Administrator verification is temporarily unavailable." },
      { status: 503 },
    );
  }
}
