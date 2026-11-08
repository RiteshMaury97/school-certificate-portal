import { NextResponse } from "next/server";

import { getRequestOrigin } from "./server/request-origin";
import { absoluteUrl, getAllowedOrigins } from "./server/site-origin";
import { isAllowedRequestOrigin } from "./shared/origin-policy";

import type { NextRequest } from "next/server";

let maintenanceCache: { enabled: boolean; expiresAt: number } | null = null;
let maintenanceRead: Promise<boolean> | null = null;
const locationDecisionCache = new Map<
  string,
  {
    result: { allowed: boolean; reason?: string };
    expiresAt: number;
  }
>();

function buildCsp(nonce: string, allowSameOriginFrame = false): string {
  const dev = process.env.NODE_ENV !== "production";
  const telemetryOrigins = [process.env.PLAUSIBLE_SCRIPT_URL, process.env.BROWSER_SENTRY_DSN]
    .flatMap((value) => {
      try {
        return value ? [new URL(value).origin] : [];
      } catch {
        return [];
      }
    })
    .filter((value, index, values) => values.indexOf(value) === index);
  let plausibleScriptOrigin = "";
  try {
    plausibleScriptOrigin = process.env.PLAUSIBLE_SCRIPT_URL
      ? new URL(process.env.PLAUSIBLE_SCRIPT_URL).origin
      : "";
  } catch {
    // An invalid optional analytics URL should not break security headers.
  }
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN;
  const authOrigin = authDomain ? `https://${authDomain}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com https://www.google.com https://www.gstatic.com https://apis.google.com ${plausibleScriptOrigin}`,
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`} https://fonts.googleapis.com`,
    `style-src-elem 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`} https://fonts.googleapis.com`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.gstatic.com",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
    `connect-src 'self' data: ${dev ? "ws://localhost:* ws://127.0.0.1:*" : ""} https://plausible.io https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com https://www.googleapis.com https://www.google.com https://www.gstatic.com https://challenges.cloudflare.com ${telemetryOrigins.join(" ")}`,
    `frame-src 'self' https://challenges.cloudflare.com ${authOrigin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${allowSameOriginFrame ? "'self'" : "'none'"}`,
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

function securityHeaders(
  response: NextResponse,
  nonce: string,
  production: boolean,
  allowSameOriginFrame = false,
): void {
  response.headers.set("Content-Security-Policy", buildCsp(nonce, allowSameOriginFrame));
  response.headers.set("X-Frame-Options", allowSameOriginFrame ? "SAMEORIGIN" : "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  if (production) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function maintenanceModeEnabled(): Promise<boolean> {
  if (maintenanceCache && maintenanceCache.expiresAt > Date.now()) return maintenanceCache.enabled;
  maintenanceRead ??= readMaintenanceMode().finally(() => {
    maintenanceRead = null;
  });
  const enabled = await maintenanceRead;
  maintenanceCache = { enabled, expiresAt: Date.now() + 30_000 };
  return enabled;
}

async function readMaintenanceMode(): Promise<boolean> {
  try {
    const response = await fetch(absoluteUrl("/api/public/site-settings"), {
      cache: "no-store",
      signal: AbortSignal.timeout(1800),
    });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    if (!isRecord(body) || !isRecord(body.settings)) return false;
    return body.settings.maintenanceMode === true;
  } catch {
    return false;
  }
}

function httpsRedirect(request: NextRequest, production: boolean): NextResponse | null {
  if (!production || request.nextUrl.protocol === "https:") return null;
  return NextResponse.redirect(
    absoluteUrl(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    308,
  );
}

function isLoggedOutSessionCheck(request: NextRequest): boolean {
  return (
    request.nextUrl.pathname === "/api/admin/session" &&
    request.method === "GET" &&
    !request.cookies.get("sis_admin_session")?.value
  );
}

function isSafeReadWithoutOrigin(request: NextRequest, origin: string | null): boolean {
  return !origin && ["GET", "HEAD"].includes(request.method);
}

function isApiMutationMissingOrigin(request: NextRequest, origin: string | null): boolean {
  return (
    !origin &&
    !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
    request.nextUrl.pathname.startsWith("/api/")
  );
}

function originResponse(request: NextRequest, production: boolean): NextResponse | null {
  const origin = request.headers.get("origin");
  if (isLoggedOutSessionCheck(request) || isSafeReadWithoutOrigin(request, origin)) return null;
  // Safe reads without Origin and logged-out session checks need no CORS
  // decision, even when the deployment origin is misconfigured.
  let expectedOrigin: string[];
  try {
    expectedOrigin = getAllowedOrigins();
  } catch (error) {
    console.error("[proxy origin configuration]", error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        error: "The server is not configured correctly. Contact the site owner.",
        stage: "origin-config",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (origin && !isAllowedRequestOrigin(origin, expectedOrigin, !production)) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  if (isApiMutationMissingOrigin(request, origin)) {
    return NextResponse.json({ error: "Request origin is required." }, { status: 403 });
  }
  if (request.method !== "OPTIONS") return null;
  if (!isAllowedRequestOrigin(origin, expectedOrigin, !production))
    return new NextResponse(null, { status: 403 });
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
      Vary: "Origin",
      "Cache-Control": "no-store",
    },
  });
}

function isAdminPage(path: string): boolean {
  return path === "/admin" || path.startsWith("/admin/");
}

function isAdminPath(path: string): boolean {
  return isAdminPage(path) || path === "/api/admin" || path.startsWith("/api/admin/");
}

function isRevokedSessionReason(reason: string | undefined): boolean {
  return reason === "country_changed" || reason === "session_revoked";
}

// eslint-disable-next-line complexity -- reason: Keep production location decisions together so redirects and cookie clearing stay consistent.
async function adminLocationGate(
  request: NextRequest,
  nonce: string,
  production: boolean,
): Promise<NextResponse | null> {
  // Location headers are supplied by the trusted production edge. Local
  // development has no reliable country/IP context and must not replace an
  // admin page with the middleware's JSON denial response.
  if (!production || !isAdminPath(request.nextUrl.pathname)) return null;
  // The unauthenticated login document contains no protected data. Keep it
  // reachable even when the location service is unavailable or the visitor
  // is outside the admin allowlist; sign-in APIs and authenticated admin
  // pages remain subject to this gate.
  if (request.nextUrl.pathname === "/admin/login") return null;
  // Session status is checked in the Node route, which can clear a stale
  // cookie and enforce location policy without returning a proxy JSON error.
  if (request.nextUrl.pathname === "/api/admin/session" && request.method === "GET") return null;
  const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  if (secret.length < 32) return locationGateResponse(nonce, production, 503);
  try {
    const decision = await checkLocationPolicyCached(request, secret);
    if (decision.allowed) return null;
    if (isRevokedSessionReason(decision.reason)) {
      const isLoginPage = request.nextUrl.pathname === "/admin/login";
      const response =
        isAdminPage(request.nextUrl.pathname) && !isLoginPage
          ? NextResponse.redirect(absoluteUrl("/admin/login"), 307)
          : isLoginPage
            ? createRequestResponse(request, production).response
            : locationGateResponse(nonce, production, 403);
      response.cookies.set("sis_admin_session", "", { path: "/", maxAge: 0 });
      response.cookies.set("sis_admin_csrf", "", { path: "/", maxAge: 0 });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    return locationGateResponse(nonce, production, 403);
  } catch {
    return locationGateResponse(nonce, production, 503);
  }
}

async function checkLocationPolicyCached(
  request: NextRequest,
  secret: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const origin = getRequestOrigin(request);
  const sessionCookie = request.cookies.get("sis_admin_session")?.value ?? "";
  const rawKey = `${request.nextUrl.pathname}\u0000${origin.ip ?? ""}\u0000${origin.country ?? ""}\u0000${sessionCookie}`;
  const keyBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
  const key = Array.from(new Uint8Array(keyBytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const now = Date.now();
  const cached = locationDecisionCache.get(key);
  if (cached && cached.expiresAt > now) return cached.result;
  const result = await checkLocationPolicy(request, secret);
  locationDecisionCache.set(key, { result, expiresAt: now + 5_000 });
  if (locationDecisionCache.size > 5000) {
    for (const [cacheKey, value] of locationDecisionCache) {
      if (value.expiresAt <= now) locationDecisionCache.delete(cacheKey);
    }
  }
  return result;
}

function locationGateResponse(nonce: string, production: boolean, status: 403 | 503): NextResponse {
  const response = NextResponse.json(
    { error: "Request could not be authorized.", stage: "location-gate" },
    { status },
  );
  securityHeaders(response, nonce, production);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

async function checkLocationPolicy(
  request: NextRequest,
  secret: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const timestamp = Date.now().toString();
  const origin = getRequestOrigin(request);
  const payload = JSON.stringify({
    path: request.nextUrl.pathname,
    ip: origin.ip,
    country: origin.country,
    sessionCookie: request.cookies.get("sis_admin_session")?.value ?? null,
  });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`admin-location-check:${timestamp}:${payload}`),
  );
  const token = Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const response = await fetch(absoluteUrl("/api/internal/admin-location-check"), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${timestamp}.${token}` },
    body: payload,
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  });
  if (!response.ok) throw new Error("Location policy check unavailable");
  const result: unknown = await response.json();
  if (typeof result !== "object" || result === null || !("allowed" in result))
    return { allowed: false };
  return {
    allowed: result.allowed === true,
    ...("reason" in result && typeof result.reason === "string" ? { reason: result.reason } : {}),
  };
}

function adminLoginRedirect(request: NextRequest, path: string): NextResponse | null {
  if (
    !isAdminPage(path) ||
    path === "/admin/login" ||
    request.cookies.get("sis_admin_session")?.value
  )
    return null;
  const login = new URL(absoluteUrl("/admin/login"));
  login.searchParams.set("next", path);
  return NextResponse.redirect(login);
}

function isMaintenanceExempt(path: string): boolean {
  return (
    isAdminPage(path) ||
    path.startsWith("/api/admin/") ||
    path === "/maintenance" ||
    path === "/offline" ||
    isMetadataRoute(path) ||
    isAlwaysAvailableApiPath(path) ||
    path.startsWith("/api/cron/") ||
    path === "/api/public/site-settings" ||
    path.startsWith("/_next/") ||
    path.startsWith("/icons/") ||
    path === "/manifest.webmanifest" ||
    path === "/sw.js"
  );
}

function isAlwaysAvailableApiPath(path: string): boolean {
  return path === "/api/health" || path === "/api/app-check/token";
}

function isMetadataRoute(path: string): boolean {
  return path === "/sitemap.xml" || path === "/robots.txt";
}

async function maintenanceResponse(
  request: NextRequest,
  path: string,
  production: boolean,
  nonce: string,
): Promise<NextResponse | null> {
  const isApi = path.startsWith("/api/");
  const isPageRead = !isApi && ["GET", "HEAD"].includes(request.method);
  if (isMaintenanceExempt(path) || (!isPageRead && !isApi) || !(await maintenanceModeEnabled()))
    return null;

  const blocked = isApi
    ? NextResponse.json(
        { error: "Service temporarily unavailable for maintenance.", stage: "maintenance" },
        { status: 503 },
      )
    : (() => {
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-nonce", nonce);
        requestHeaders.set("Content-Security-Policy", buildCsp(nonce));
        return NextResponse.rewrite(absoluteUrl("/maintenance"), {
          request: { headers: requestHeaders },
          status: 503,
        });
      })();
  securityHeaders(blocked, nonce, production);
  blocked.headers.set("Retry-After", "900");
  blocked.headers.set("Cache-Control", "no-store");
  blocked.headers.set("X-Robots-Tag", "noindex, nofollow");
  return blocked;
}

function isNoIndexPath(path: string): boolean {
  return (
    path.startsWith("/api/") ||
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/api/certificates/search") ||
    path.startsWith("/api/certificates/") ||
    path === "/maintenance" ||
    path === "/certificates/results" ||
    path === "/certificates/print"
  );
}

function setResponsePolicyHeaders(
  response: NextResponse,
  request: NextRequest,
  path: string,
): void {
  if (isNoIndexPath(path) || (path === "/verify" && request.nextUrl.searchParams.size > 0)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  }
  if (request.headers.get("accept")?.includes("text/html")) {
    // A nonce-bearing document must never be reused by a browser or CDN.
    response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  } else if (path.startsWith("/api/") || path.startsWith("/admin")) {
    response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  }
}

function createRequestResponse(request: NextRequest, production: boolean) {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  const allowSameOriginFrame = /^\/api\/admin\/certificates\/[^/]+\/preview-file$/.test(
    request.nextUrl.pathname,
  );
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", buildCsp(nonce, allowSameOriginFrame));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  securityHeaders(response, nonce, production, allowSameOriginFrame);
  return { nonce, response };
}

async function continueRequest(
  request: NextRequest,
  response: NextResponse,
  nonce: string,
  production: boolean,
): Promise<NextResponse> {
  const path = request.nextUrl.pathname;
  const origin = originResponse(request, production);
  if (origin) return origin;
  const locationBlocked = await adminLocationGate(request, nonce, production);
  if (locationBlocked) return locationBlocked;
  const login = adminLoginRedirect(request, path);
  if (login) return login;
  const maintenance = await maintenanceResponse(request, path, production, nonce);
  if (maintenance) return maintenance;
  setResponsePolicyHeaders(response, request, path);
  return response;
}

export async function proxy(request: NextRequest) {
  const production = process.env.NODE_ENV === "production";
  const redirect = httpsRedirect(request, production);
  const result =
    redirect ??
    (await (async () => {
      const { nonce, response } = createRequestResponse(request, production);
      return continueRequest(request, response, nonce, production);
    })());
  if (process.env.VERCEL_ENV !== "production" || isAdminPage(request.nextUrl.pathname)) {
    result.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return result;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/internal/admin-location-check).*)"],
};
