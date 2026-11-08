import { createHmac, randomBytes } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { after } from "next/server";

import { enforceAdminLocation } from "@/server/admin-location";
import { consumeVerifiedAdminOtpChallenge } from "@/server/admin-otp";
import { adminAuth, db, describeFirebaseError } from "@/server/firebase-admin";
import { escapeHtml, sendMail } from "@/server/mailer";
import { getRequestOrigin, requesterIp } from "@/server/request-origin";
import {
  adminSessionCookieOptions,
  assertVerifiedGoogleSignIn,
  createCsrfToken,
  csrfCookieOptions,
  isGoogleSignIn,
  sameOrigin,
  writeAuditLog,
  verifyAppCheckUnlessGoogle,
  verifyCsrf,
  hashRequesterIp,
} from "@/server/security";
import { absoluteUrl } from "@/server/site-origin";
import { readErrorCode } from "@/shared/safe-values";
import { ADMIN_HARD_SESSION_LIMIT_MS, isAdminSessionExpired } from "@/shared/session-policy";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const COOKIE = "sis_admin_session";
const DEVICE_COOKIE = "sis_admin_device";
type AdminRole = "uploader" | "approver" | "admin" | "superadmin";
function isAdminRole(value: unknown): value is AdminRole {
  return (
    value === "uploader" || value === "approver" || value === "admin" || value === "superadmin"
  );
}
function timestampMillis(value: unknown): number {
  return value instanceof Timestamp ? value.toDate().getTime() : 0;
}
const secret = () => {
  const value = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  if (Buffer.byteLength(value) < 32) throw new Error("AUDIT_LOG_HMAC_SECRET is not configured");
  return value;
};
const digest = (value: string) => createHmac("sha256", secret()).update(value).digest("hex");
function browser(ua: string) {
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/")) return "Safari";
  return "Unknown browser";
}
async function sendAlert(to: string, body: string) {
  const siteSettings = await db.collection("siteSettings").doc("main").get();
  const schoolName =
    String(siteSettings.get("schoolName") ?? "").trim() || "Satyam International School";
  await sendMail({
    to,
    subject: `${schoolName}: new staff sign-in`,
    html: `<p>${escapeHtml(schoolName)}</p>${body}`,
  });
}

type LoginBody = { idToken: string; challengeId: string };
type LoginIdentity = {
  decoded: Awaited<ReturnType<typeof adminAuth.verifyIdToken>>;
  email: string;
  role: AdminRole;
};

function readLoginBody(value: unknown): LoginBody | NextResponse {
  if (!isLoginBody(value))
    return NextResponse.json({ error: "Authentication failed." }, { status: 400 });
  if (!/^[0-9a-f-]{36}$/i.test(value.challengeId))
    return NextResponse.json(
      { error: "Complete email verification before continuing." },
      { status: 403 },
    );
  return { idToken: value.idToken, challengeId: value.challengeId };
}

function isLoginBody(value: unknown): value is LoginBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "idToken" in value &&
    typeof value.idToken === "string" &&
    "challengeId" in value &&
    typeof value.challengeId === "string"
  );
}

async function authenticateLogin(
  request: NextRequest,
  body: LoginBody,
  appCheckSkipped: boolean,
): Promise<LoginIdentity | NextResponse> {
  const decoded = await adminAuth.verifyIdToken(body.idToken, true);
  if (appCheckSkipped) assertVerifiedGoogleSignIn(decoded);
  const email = decoded.email?.toLowerCase() ?? "";
  const emailHash = digest(email);
  const failureState = await db.collection("adminLoginFailures").doc(emailHash).get();
  if (Number(failureState.get("lockedUntil") ?? 0) > Date.now())
    return NextResponse.json(
      { error: "This account is temporarily locked after repeated failed sign-ins." },
      { status: 423 },
    );
  const admin = await db.collection("admins").doc(decoded.uid).get();
  const roleValue: unknown = admin.get("role");
  const role = isAdminRole(roleValue) ? roleValue : null;
  const status = String(admin.get("status"));
  const adminEmail: unknown = admin.get("email");
  if (
    !role ||
    !isAuthorizedAdminAccount({
      exists: admin.exists,
      mustChangePassword: admin.get("mustChangePassword"),
      decodedMustChangePassword: decoded.mustChangePassword,
      status,
      email,
      adminEmail,
      role,
      decodedRole: decoded.role,
    })
  )
    return NextResponse.json({ error: "This account is not authorized." }, { status: 403 });
  const location = await enforceAdminLocation({ request, adminUid: decoded.uid });
  if (!location.allowed)
    return NextResponse.json(
      { error: "This sign-in cannot be completed from your current network." },
      { status: 403 },
    );
  const challengeRef = db.collection("adminOtpChallenges").doc(body.challengeId);
  const consumed = await db.runTransaction((transaction) =>
    consumeVerifiedAdminOtpChallenge(transaction, challengeRef, decoded.uid),
  );
  if (!consumed)
    return NextResponse.json(
      { error: "Email verification is missing, expired, or already used. Sign in again." },
      { status: 403 },
    );
  if (status === "invited")
    await admin.ref.update({ status: "active", activatedAt: FieldValue.serverTimestamp() });
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
  return { decoded, email, role };
}

function isAuthorizedAdminAccount(input: {
  exists: boolean;
  mustChangePassword: unknown;
  decodedMustChangePassword: unknown;
  status: string;
  email: string;
  adminEmail: unknown;
  role: AdminRole | null;
  decodedRole: unknown;
}): boolean {
  const {
    exists,
    mustChangePassword,
    decodedMustChangePassword,
    status,
    email,
    adminEmail,
    role,
    decodedRole,
  } = input;
  return (
    exists &&
    mustChangePassword !== true &&
    decodedMustChangePassword !== true &&
    ["active", "invited"].includes(status) &&
    email.length > 0 &&
    typeof adminEmail === "string" &&
    adminEmail.toLowerCase() === email &&
    decodedRole === role
  );
}

function escapeCity(city: string): string {
  const escapeMap: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return city.replace(/[&<>"']/g, (character) => escapeMap[character] ?? character);
}

async function saveSessionRecords(input: {
  request: NextRequest;
  uid: string;
  email: string;
  role: AdminRole;
  session: string;
  sessionHash: string;
  deviceId: string;
  now: Date;
  city: string;
  country: string;
  userAgent: string;
}) {
  const { request, uid, email, role, sessionHash, deviceId, now, city, country, userAgent } = input;
  const deviceHash = digest(`${userAgent}|${deviceId}`);
  const deviceRef = db.collection("adminDevices").doc(`${uid}_${deviceHash}`);
  const loginLocationRef = db.collection("adminLoginLocations").doc(uid);
  const [known, lastLocation] = await Promise.all([deviceRef.get(), loginLocationRef.get()]);
  const storedCountry: unknown = lastLocation.get("country");
  const deviceCountry: unknown = known.get("country");
  const priorCreatedAt: unknown = known.get("createdAt");
  const priorCountry =
    typeof storedCountry === "string"
      ? storedCountry
      : typeof deviceCountry === "string"
        ? deviceCountry
        : "";
  const countryChanged = Boolean(country && priorCountry && country !== priorCountry);
  await deviceRef.set(
    {
      uid,
      deviceHash,
      browser: browser(userAgent),
      city,
      country,
      ipHash: hashRequesterIp(request),
      lastSeenAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60_000),
      createdAt: known.exists ? (priorCreatedAt ?? now) : now,
    },
    { merge: true },
  );
  await db
    .collection("adminSessions")
    .doc(sessionHash)
    .create({
      uid,
      email,
      role,
      sessionId: randomBytes(18).toString("hex"),
      deviceHash,
      browser: browser(userAgent),
      city,
      country,
      ipHash: hashRequesterIp(request),
      createdAt: now,
      lastActivityAt: now,
      absoluteExpiresAt: new Date(now.getTime() + ADMIN_HARD_SESSION_LIMIT_MS),
      revokedAt: null,
    });
  await loginLocationRef.set({ country, lastSignInAt: now }, { merge: true });
  return { deviceHash, isNewDevice: !known.exists, countryChanged };
}

async function scheduleNewDeviceAlert(input: {
  identity: LoginIdentity;
  city: string;
  country: string;
  countryChanged: boolean;
  isNewDevice: boolean;
  userAgent: string;
  now: Date;
}): Promise<void> {
  const { identity, city, country, countryChanged, isNewDevice, userAgent, now } = input;
  if (!isNewDevice && !countryChanged) return;
  const actionToken = randomBytes(32).toString("base64url");
  const tokenHash = digest(actionToken);
  const link = absoluteUrl(
    `/api/admin/session/revoke-all?token=${encodeURIComponent(actionToken)}`,
  );
  const localTime = `${new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(now)} IST`;
  const countryNotice = countryChanged
    ? ` This sign-in is from a new country: ${escapeHtml(country)}.`
    : country
      ? ` Country: ${escapeHtml(country)}.`
      : "";
  await db
    .collection("adminSessionActions")
    .doc(tokenHash)
    .create({
      uid: identity.decoded.uid,
      expiresAt: new Date(Date.now() + 10 * 60_000),
      usedAt: null,
      createdAt: now,
    });
  after(() =>
    sendAlert(
      identity.email,
      `<p>New sign-in to the admin panel from ${escapeHtml(browser(userAgent))}, ${escapeCity(city)}, ${escapeHtml(localTime)}.${countryNotice}</p><p>If this wasn't you, <a href="${escapeHtml(link)}">sign out everywhere</a>.</p>`,
    ).catch((alertError: unknown) => {
      console.error("[admin/session new-device alert]", describeFirebaseError(alertError));
    }),
  );
}

function decodeCity(value: string | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value).slice(0, 80);
  } catch {
    return value.slice(0, 80);
  }
}

async function establishSession(
  request: NextRequest,
  body: LoginBody,
  identity: LoginIdentity,
  onStage: (stage: string) => void = () => undefined,
): Promise<NextResponse> {
  onStage("create-session-cookie");
  const session = await adminAuth.createSessionCookie(body.idToken, {
    expiresIn: ADMIN_HARD_SESSION_LIMIT_MS,
  });
  const sessionHash = digest(session);
  const now = new Date();
  const deviceId =
    request.cookies.get(DEVICE_COOKIE)?.value ?? randomBytes(24).toString("base64url");
  const userAgent = request.headers.get("user-agent") ?? "";
  const requestOrigin = getRequestOrigin(request);
  const city = decodeCity(requestOrigin.city);
  const country = (requestOrigin.country ?? "").slice(0, 8);
  onStage("save-session-records");
  const record = await saveSessionRecords({
    request,
    uid: identity.decoded.uid,
    email: identity.email,
    role: identity.role,
    session,
    sessionHash,
    deviceId,
    now,
    city,
    country,
    userAgent,
  });
  onStage("new-device-alert");
  // The session is already valid at this point. A failure to queue the "new sign-in" e-mail must
  // not block an otherwise successful login, so it is logged and skipped.
  await scheduleNewDeviceAlert({ ...record, identity, city, country, userAgent, now }).catch(
    (alertError: unknown) => {
      console.error("[admin/session new-device alert setup]", describeFirebaseError(alertError));
    },
  );
  onStage("audit-log");
  const csrf = createCsrfToken();
  const googleLogin = isGoogleSignIn(identity.decoded);
  await writeAuditLog(request, identity.decoded.uid, "admin.login", "session");
  const response = NextResponse.json(
    { ok: true, email: identity.email, role: identity.role },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(COOKIE, session, adminSessionCookieOptions());
  response.cookies.set("sis_admin_csrf", csrf, csrfCookieOptions());
  // Non-secret hint so the browser skips fetching a Turnstile App Check token on admin pages for
  // Google sessions. The server never trusts it: it re-reads the provider from the session cookie.
  response.cookies.set(
    "sis_admin_provider",
    googleLogin ? "google" : "",
    googleLogin ? csrfCookieOptions() : { ...csrfCookieOptions(), maxAge: 0 },
  );
  response.cookies.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  return response;
}

function sessionRouteError(
  error: unknown,
  method: "GET" | "POST" | "DELETE",
  stage = "unknown",
): NextResponse {
  if (error instanceof Error && error.message === "APP_CHECK")
    return NextResponse.json(
      {
        error:
          method === "GET"
            ? "App verification failed."
            : "App verification failed. Reload the page and try again.",
      },
      { status: 403 },
    );
  if (readErrorCode(error).startsWith("auth/")) {
    return method === "GET"
      ? unauthenticatedSessionResponse()
      : NextResponse.json({ error: "Authentication failed." }, { status: 401 });
  }
  console.error(`[admin/session ${method}] stage=${stage}`, describeFirebaseError(error));
  return NextResponse.json(
    {
      authenticated: false,
      error: "The server is not configured correctly. Contact the site owner.",
      // Non-sensitive step name so the site owner can match this to the server log entry.
      ...(method === "POST" ? { stage } : {}),
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

async function revokeSessionForLogout(request: NextRequest, session: string): Promise<void> {
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
  } catch (error) {
    if (!readErrorCode(error).startsWith("auth/")) throw error;
  }
}
export async function POST(request: NextRequest) {
  let stage = "request-checks";
  try {
    if (!requesterIp(request))
      return NextResponse.json(
        { error: "Client network information is unavailable." },
        { status: 503 },
      );
    if (!sameOrigin(request))
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    stage = "read-body";
    const bodyResult = readLoginBody(await request.json());
    if (bodyResult instanceof NextResponse) return bodyResult;
    // Turnstile/App Check is required for email+password sign-ins only; Google sign-ins skip it.
    stage = "app-check";
    const appCheck = await verifyAppCheckUnlessGoogle(request, bodyResult.idToken);
    stage = "authenticate";
    const identity = await authenticateLogin(request, bodyResult, appCheck.skipped);
    if (identity instanceof NextResponse) return identity;
    return await establishSession(request, bodyResult, identity, (next) => {
      stage = next;
    });
  } catch (error) {
    return sessionRouteError(error, "POST", stage);
  }
}
function sessionRecordIsValid(
  sessionDoc: FirebaseFirestore.DocumentSnapshot,
  uid: string,
): boolean {
  const lastActivity = timestampMillis(sessionDoc.get("lastActivityAt"));
  const expiry = timestampMillis(sessionDoc.get("absoluteExpiresAt"));
  return (
    sessionDoc.exists &&
    sessionDoc.get("uid") === uid &&
    !sessionDoc.get("revokedAt") &&
    !isAdminSessionExpired(lastActivity, expiry)
  );
}

function adminRecordIsValid(
  admin: FirebaseFirestore.DocumentSnapshot,
  decoded: Awaited<ReturnType<typeof adminAuth.verifySessionCookie>>,
  role: AdminRole | null,
): boolean {
  const adminEmail: unknown = admin.get("email");
  return (
    admin.exists &&
    admin.get("status") === "active" &&
    role !== null &&
    typeof adminEmail === "string" &&
    adminEmail.toLowerCase() === decoded.email?.toLowerCase() &&
    decoded.role === role
  );
}

function unauthenticatedSessionResponse(): NextResponse {
  const response = NextResponse.json(
    { authenticated: false },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(COOKIE, "", { ...adminSessionCookieOptions(), maxAge: 0 });
  response.cookies.set("sis_admin_csrf", "", { ...csrfCookieOptions(), maxAge: 0 });
  return response;
}

async function readSessionStatus(
  request: NextRequest,
  session: string,
  appCheckSkipped: boolean,
): Promise<NextResponse> {
  const decoded = await adminAuth.verifySessionCookie(session, true);
  if (appCheckSkipped) assertVerifiedGoogleSignIn(decoded);
  const admin = await db.collection("admins").doc(decoded.uid).get();
  const roleValue: unknown = admin.get("role");
  const role = isAdminRole(roleValue) ? roleValue : null;
  const sessionDoc = await db.collection("adminSessions").doc(digest(session)).get();
  const expiry = timestampMillis(sessionDoc.get("absoluteExpiresAt"));
  if (
    !sessionRecordIsValid(sessionDoc, decoded.uid) ||
    !adminRecordIsValid(admin, decoded, role)
  ) {
    return unauthenticatedSessionResponse();
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- reason: Firestore stores this optional country field as unknown; validate its type below.
  const sessionCountry = sessionDoc.get("country");
  const location = await enforceAdminLocation({
    request,
    adminUid: decoded.uid,
    sessionCountry: typeof sessionCountry === "string" ? sessionCountry : null,
    sessionRef: sessionDoc.ref,
  });
  if (!location.allowed) return unauthenticatedSessionResponse();
  await sessionDoc.ref.update({
    lastActivityAt: new Date(),
    lastSeenAt: FieldValue.serverTimestamp(),
  });
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
}

export async function GET(request: NextRequest) {
  const session = request.cookies.get(COOKIE)?.value;
  if (!session)
    return NextResponse.json(
      { authenticated: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  try {
    const appCheck = await verifyAppCheckUnlessGoogle(request, session);
    return await readSessionStatus(request, session, appCheck.skipped);
  } catch (error) {
    return sessionRouteError(error, "GET");
  }
}
export async function DELETE(request: NextRequest) {
  try {
    // Signing out only revokes the caller's own verified session, so a Google session needs no
    // Turnstile token; an unverifiable cookie is ignored by revokeSessionForLogout.
    await verifyAppCheckUnlessGoogle(request, request.cookies.get(COOKIE)?.value);
    if (!verifyCsrf(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const session = request.cookies.get(COOKIE)?.value;
    if (session) await revokeSessionForLogout(request, session);
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
  } catch (error) {
    return sessionRouteError(error, "DELETE");
  }
}
