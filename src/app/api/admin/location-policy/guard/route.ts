import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  auditAdminLocation,
  evaluateAdminLocation,
  revokeSessionOnCountryChange,
  sessionAdminUid,
} from "@/server/admin-location";
import { adminAuth, db } from "@/server/firebase-admin";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isInternalMiddlewareRequest(request: NextRequest): boolean {
  const expected = Buffer.from(process.env.AUDIT_LOG_HMAC_SECRET ?? "", "utf8");
  const actual = Buffer.from(request.headers.get("x-admin-location-guard") ?? "", "utf8");
  return (
    expected.length >= 32 && expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

export async function GET(request: NextRequest) {
  if (!isInternalMiddlewareRequest(request))
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  try {
    if (await revokeSessionOnCountryChange(request))
      return NextResponse.json(
        { allowed: false },
        {
          status: 403,
          headers: { "Cache-Control": "no-store", "x-admin-session-revoked": "true" },
        },
      );
    let adminUid = await sessionAdminUid(request);
    const authorization = request.headers.get("authorization");
    if (!adminUid && authorization?.startsWith("Bearer ")) {
      try {
        adminUid = (await adminAuth.verifyIdToken(authorization.slice(7), true)).uid;
      } catch {
        adminUid = undefined;
      }
    }
    if (!adminUid) {
      const email = request.headers.get("x-admin-email")?.trim().toLowerCase();
      if (email) {
        const admin = await db.collection("admins").where("email", "==", email).limit(1).get();
        if (!admin.empty) adminUid = admin.docs[0]?.id;
      }
    }
    const decision = await evaluateAdminLocation(request, adminUid);
    if (!decision.allowed) {
      await auditAdminLocation(request, {
        actorUid: adminUid,
        country: decision.country,
        action:
          decision.policy.adminEnforcementMode === "block"
            ? "admin.location.block"
            : "admin.location.alert",
        reason: decision.reason,
      });
      if (decision.policy.adminEnforcementMode === "block")
        return NextResponse.json(
          { error: "Access denied." },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
    }
    return NextResponse.json({ allowed: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { error: "Access denied." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
