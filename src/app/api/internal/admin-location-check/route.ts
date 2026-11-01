import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { enforceAdminLocation, readAdminLocationPolicy } from "@/server/admin-location";
import { adminAuth, db } from "@/server/firebase-admin";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MiddlewareInput = {
  path: string;
  ip: string | null;
  country: string | null;
  sessionCookie: string | null;
};
type SessionLocation = {
  adminUid?: string;
  revoked?: boolean;
  sessionCountry?: string | null;
  sessionRef?: FirebaseFirestore.DocumentReference;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAdminPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    (path === "/admin" ||
      path.startsWith("/admin/") ||
      path === "/api/admin" ||
      path.startsWith("/api/admin/"))
  );
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function nullableCountry(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^[A-Z]{2}$/.test(value));
}

function authorized(request: NextRequest, payload: string): boolean {
  const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([0-9]{13})\.([a-f0-9]{64})$/.exec(authorization);
  if (secret.length < 32 || !match?.[1] || !match[2]) return false;
  if (Math.abs(Date.now() - Number(match[1])) > 30_000) return false;
  const expected = createHmac("sha256", secret)
    .update(`admin-location-check:${match[1]}:${payload}`)
    .digest();
  const supplied = Buffer.from(match[2], "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function parseInput(payload: string): MiddlewareInput | null {
  let value: unknown;
  try {
    value = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  const { path, ip, country, sessionCookie } = value;
  if (
    !isAdminPath(path) ||
    !nullableString(ip) ||
    !nullableCountry(country) ||
    !nullableString(sessionCookie)
  )
    return null;
  return { path, ip, country, sessionCookie };
}

async function readSessionLocation(sessionCookie: string | null): Promise<SessionLocation> {
  if (!sessionCookie) return {};
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const sessionHash = createHmac("sha256", process.env.AUDIT_LOG_HMAC_SECRET ?? "")
      .update(sessionCookie)
      .digest("hex");
    const ref = db.collection("adminSessions").doc(sessionHash);
    const snapshot = await ref.get();
    if (!snapshot.exists) return { adminUid: decoded.uid };
    if (snapshot.get("revokedAt")) return { adminUid: decoded.uid, revoked: true };
    const value: unknown = snapshot.get("country");
    return {
      adminUid: decoded.uid,
      sessionRef: ref,
      sessionCountry: typeof value === "string" ? value : null,
    };
  } catch {
    // Normal admin authorization will reject invalid or expired cookies.
    return {};
  }
}

async function hasUnidentifiedAdminException(path: string, adminUid?: string): Promise<boolean> {
  const signInPath = [
    "/admin/login",
    "/api/admin/preflight",
    "/api/admin/otp/send",
    "/api/admin/otp/verify",
    "/api/admin/session",
  ].includes(path);
  if (!signInPath || adminUid) return false;
  const policy = await readAdminLocationPolicy();
  return policy.adminLocationExceptions.some(
    (item) => item.adminUid && Date.parse(item.expiresAt) > Date.now(),
  );
}

export async function POST(request: NextRequest) {
  const payload = await request.text();
  if (!authorized(request, payload))
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const data = parseInput(payload);
  if (!data) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const session = await readSessionLocation(data.sessionCookie);
    if (session.revoked)
      return NextResponse.json(
        { allowed: false, reason: "session_revoked" },
        { headers: { "Cache-Control": "no-store" } },
      );
    if (await hasUnidentifiedAdminException(data.path, session.adminUid)) {
      return NextResponse.json({ allowed: true }, { headers: { "Cache-Control": "no-store" } });
    }
    const originRequest = {
      headers: new Headers({
        ...(data.ip ? { "x-vercel-forwarded-for": data.ip } : {}),
        ...(data.country ? { "x-vercel-ip-country": data.country } : {}),
      }),
    };
    const result = await enforceAdminLocation({ request: originRequest, ...session });
    return NextResponse.json(
      { allowed: result.allowed, ...(result.reason ? { reason: result.reason } : {}) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Location policy check unavailable." }, { status: 503 });
  }
}
