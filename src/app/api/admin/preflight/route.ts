import { NextRequest, NextResponse } from "next/server";
import { adminAuth, db } from "@/server/firebase-admin";
import { sameOrigin, verifyRequestAppCheck } from "@/server/security";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
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
      !decoded.email_verified ||
      !email ||
      !admin.exists ||
      // "invited" accounts must be able to enrol their authenticator on first sign-in.
      !["active", "invited"].includes(String(admin.get("status"))) ||
      admin.get("email")?.toLowerCase() !== email ||
      !["uploader", "approver", "superadmin"].includes(
        String(admin.get("role")),
      ) ||
      decoded.role !== admin.get("role")
    )
      return NextResponse.json(
        { error: "This account is not authorized." },
        { status: 403 },
      );
    return NextResponse.json(
      { authorized: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to verify administrator account." },
      { status: 401 },
    );
  }
}
