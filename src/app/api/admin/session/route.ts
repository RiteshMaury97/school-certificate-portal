import { createHmac, randomBytes } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { after } from "next/server";

import { consumeVerifiedAdminOtpChallenge } from "@/server/admin-otp";
import { adminAuth, db, describeFirebaseError } from "@/server/firebase-admin";
import { escapeHtml, sendMail } from "@/server/mailer";
import {
  adminSessionCookieOptions,
  createCsrfToken,
  csrfCookieOptions,
  sameOrigin,
  writeAuditLog,
  verifyRequestAppCheck,
  verifyCsrf,
  hashRequesterIp,
} from "@/server/security";
import {
  ADMIN_HARD_SESSION_LIMIT_MS,
  isAdminSessionExpired,
} from "@/shared/session-policy";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "sis_admin_session";
const DEVICE_COOKIE = "sis_admin_device";
const secret = () => {
  const value = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  if (Buffer.byteLength(value) < 32)
    throw new Error("AUDIT_LOG_HMAC_SECRET is not configured");
  return value;
};
const digest = (value: string) =>
  createHmac("sha256", secret()).update(value).digest("hex");
function browser(ua: string) {
  if (ua.includes('Edg/')) return "Edge";
  if (ua.includes('Chrome/')) return "Chrome";
  if (ua.includes('Firefox/')) return "Firefox";
  if (ua.includes('Safari/')) return "Safari";
  return "Unknown browser";
}
async function sendAlert(to: string, body: string) {
  const siteSettings = await db.collection("siteSettings").doc("main").get();
  const schoolName = String(siteSettings.get("schoolName") ?? "").trim() || "Satyam International School";
  await sendMail({ to, subject: `${schoolName}: new staff sign-in`, html: `<p>${escapeHtml(schoolName)}</p>${body}` });
}
export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      !("idToken" in body) ||
      typeof body.idToken !== "string"
    )
      return NextResponse.json(
        { error: "Authentication failed." },
        { status: 400 },
      );
    const decoded = await adminAuth.verifyIdToken(body.idToken, true);
    if (!("challengeId" in body) || typeof body.challengeId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.challengeId))
      return NextResponse.json({ error: "Complete email verification before continuing." }, { status: 403 });
    const email = decoded.email?.toLowerCase() ?? "";
    const emailHash = createHmac("sha256", secret())
      .update(email)
      .digest("hex");
    const failureState = await db
      .collection("adminLoginFailures")
      .doc(emailHash)
      .get();
    if (Number(failureState.get("lockedUntil") ?? 0) > Date.now())
      return NextResponse.json(
        {
          error:
            "This account is temporarily locked after repeated failed sign-ins.",
        },
        { status: 423 },
      );
    const admin = await db.collection("admins").doc(decoded.uid).get();
    const role = admin.get("role");
    const status = String(admin.get("status"));
    if (
      !admin.exists ||
      admin.get("mustChangePassword") === true || decoded.mustChangePassword === true ||
      !["active", "invited"].includes(status) ||
      !email ||
      admin.get("email")?.toLowerCase() !== email ||
      (role !== "uploader" && role !== "approver" && role !== "admin" && role !== "superadmin") ||
      decoded.role !== role
    )
      return NextResponse.json(
        { error: "This account is not authorized." },
        { status: 403 },
      );

    const challengeRef = db.collection("adminOtpChallenges").doc(body.challengeId);
    const challengeConsumed = await db.runTransaction((transaction) =>
      consumeVerifiedAdminOtpChallenge(transaction, challengeRef, decoded.uid),
    );
    if (!challengeConsumed) {
      return NextResponse.json(
        { error: "Email verification is missing, expired, or already used. Sign in again." },
        { status: 403 },
      );
    }

    // A completed email-code sign-in activates an invited account.
    if (status === "invited")
      await admin.ref.update({
        status: "active",
        activatedAt: FieldValue.serverTimestamp(),
      });
    await db
      .collection("adminLoginFailures")
      .doc(emailHash)
      .set(
        {
          count: 0,
          lockedUntil: 0,
          windowStartedAt: Date.now(),
          updatedAt: FieldValue.serverTimestamp(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        },
        { merge: true },
      );
    const session = await adminAuth.createSessionCookie(body.idToken, {
      expiresIn: ADMIN_HARD_SESSION_LIMIT_MS,
    });
    const sessionHash = digest(session),
      now = new Date();
    const deviceId =
      request.cookies.get(DEVICE_COOKIE)?.value ??
      randomBytes(24).toString("base64url");
    const ua = request.headers.get("user-agent") ?? "";
    const deviceHash = digest(`${ua}|${deviceId}`);
    const rawCity =
      request.headers.get("x-vercel-ip-city") ??
      request.headers.get("cf-ipcity") ??
      "Unknown city";
    const city = (() => {
      try {
        return decodeURIComponent(rawCity).slice(0, 80);
      } catch {
        return rawCity.slice(0, 80);
      }
    })();
    const country = (
      request.headers.get("x-vercel-ip-country") ??
      request.headers.get("cf-ipcountry") ??
      ""
    ).slice(0, 8);
    const deviceRef = db
      .collection("adminDevices")
      .doc(`${decoded.uid}_${deviceHash}`);
    const known = await deviceRef.get();
    await deviceRef.set(
      {
        uid: decoded.uid,
        deviceHash,
        browser: browser(ua),
        city,
        country,
        ipHash: hashRequesterIp(request),
        lastSeenAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60_000),
        createdAt: known.exists ? (known.get("createdAt") ?? now) : now,
      },
      { merge: true },
    );
    await db
      .collection("adminSessions")
      .doc(sessionHash)
      .create({
        uid: decoded.uid,
        email,
        role,
        sessionId: randomBytes(18).toString("hex"),
        deviceHash,
        browser: browser(ua),
        city,
        country,
        ipHash: hashRequesterIp(request),
        createdAt: now,
        lastActivityAt: now,
        absoluteExpiresAt: new Date(
          now.getTime() + ADMIN_HARD_SESSION_LIMIT_MS,
        ),
        revokedAt: null,
      });
    if (!known.exists) {
      const actionToken = randomBytes(32).toString("base64url"),
        tokenHash = digest(actionToken);
      await db
        .collection("adminSessionActions")
        .doc(tokenHash)
        .create({
          uid: decoded.uid,
          expiresAt: new Date(Date.now() + 10 * 60_000),
          usedAt: null,
          createdAt: now,
        });
      const origin = process.env.APP_ORIGIN ?? request.nextUrl.origin;
      const link = `${origin}/api/admin/session/revoke-all?token=${encodeURIComponent(actionToken)}`;
      const escapeMap: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      const safeCity = city.replace(
        /[&<>"']/g,
        (char: string) => escapeMap[char] ?? char,
      );
      const localTime =
        new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(now) + " IST";
      after(() => sendAlert(
        email,
        `<p>New sign-in to the admin panel from ${escapeHtml(browser(ua))}, ${safeCity}, ${escapeHtml(localTime)}.</p><p>If this wasn't you, <a href="${escapeHtml(link)}">sign out everywhere</a>.</p>`,
      ).catch((alertError: unknown) => {
        console.error("[admin/session new-device alert]", describeFirebaseError(alertError));
      }));
    }
    const csrf = createCsrfToken();
    await writeAuditLog(request, decoded.uid, "admin.login", "session");
    const response = NextResponse.json(
      { ok: true, email, role },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(COOKIE, session, adminSessionCookieOptions());
    response.cookies.set("sis_admin_csrf", csrf, csrfCookieOptions());
    response.cookies.set(DEVICE_COOKIE, deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "APP_CHECK")
      return NextResponse.json(
        { error: "App verification failed. Reload the page and try again." },
        { status: 403 },
      );
    console.error("[admin/session POST]", describeFirebaseError(error));
    return NextResponse.json(
      { error: "Unable to establish administrator session." },
      { status: 401 },
    );
  }
}
export async function GET(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
  } catch {
    // Not "signed out": the browser could not prove it is the real app.
    return NextResponse.json(
      { authenticated: false, error: "App verification failed." },
      { status: 403 },
    );
  }
  try {
    const session = request.cookies.get(COOKIE)?.value;
    if (!session)
      return NextResponse.json({ authenticated: false }, { status: 401 });
    const decoded = await adminAuth.verifySessionCookie(session, true);
    const admin = await db.collection("admins").doc(decoded.uid).get();
    const role = admin.get("role");
    const sessionHash = digest(session),
      sessionDoc = await db.collection("adminSessions").doc(sessionHash).get();
    const lastActivity =
      sessionDoc.get("lastActivityAt")?.toDate?.()?.getTime?.() ?? 0;
    const expiry =
      sessionDoc.get("absoluteExpiresAt")?.toDate?.()?.getTime?.() ?? 0;
    if (
      !sessionDoc.exists ||
      sessionDoc.get("uid") !== decoded.uid ||
      sessionDoc.get("revokedAt") ||
      isAdminSessionExpired(lastActivity, expiry)
    )
      return NextResponse.json({ authenticated: false }, { status: 401 });
    await sessionDoc.ref.update({
      lastActivityAt: new Date(),
      lastSeenAt: FieldValue.serverTimestamp(),
    });
    if (
      !admin.exists ||
      admin.get("status") !== "active" ||
      (role !== "uploader" && role !== "approver" && role !== "admin" && role !== "superadmin") ||
      admin.get("email")?.toLowerCase() !== decoded.email?.toLowerCase() ||
      decoded.role !== role
    )
      return NextResponse.json({ authenticated: false }, { status: 401 });
    return NextResponse.json(
      {
        authenticated: true,
        uid: decoded.uid,
        email: decoded.email,
        role,
        lastActivityAt: Date.now(),
        hardExpiresAt: expiry,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const code = String((error as { code?: unknown } | null)?.code ?? "");
    // Invalid / expired / revoked cookie => signed out. Anything else is an outage.
    if (code.startsWith("auth/"))
      return NextResponse.json({ authenticated: false }, { status: 401 });
    console.error("[admin/session GET]", describeFirebaseError(error));
    return NextResponse.json(
      { authenticated: false, error: "The session service is temporarily unavailable." },
      { status: 503 },
    );
  }
}
export async function DELETE(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
  } catch {
    return NextResponse.json(
      { error: "App verification failed" },
      { status: 403 },
    );
  }
  if (!verifyCsrf(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const session = request.cookies.get(COOKIE)?.value;
  if (session) {
    try {
      const decoded = await adminAuth.verifySessionCookie(session, true);
      const sessionHash = digest(session);
      await db
        .collection("adminSessions")
        .doc(sessionHash)
        .set(
          { revokedAt: FieldValue.serverTimestamp(), revokeReason: "sign_out" },
          { merge: true },
        );
      await writeAuditLog(request, decoded.uid, "admin.logout", "session");
    } catch {
      /* Clear expired cookies too. */
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, "", {
    ...adminSessionCookieOptions(),
    maxAge: 0,
  });
  response.cookies.set("sis_admin_csrf", "", {
    ...csrfCookieOptions(),
    maxAge: 0,
  });
  return response;
}
