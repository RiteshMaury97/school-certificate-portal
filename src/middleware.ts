import { NextResponse } from "next/server";

import { isAllowedRequestOrigin } from "./shared/origin-policy";

import type { NextRequest } from "next/server";
const APP_ORIGIN = process.env.APP_ORIGIN;
function buildCsp(nonce: string, allowSameOriginFrame = false): string {
  const dev = process.env.NODE_ENV !== "production";
  const telemetryOrigins = [
    process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL,
    process.env.NEXT_PUBLIC_SENTRY_DSN,
  ]
    .flatMap((value) => {
      try {
        return value ? [new URL(value).origin] : [];
      } catch {
        return [];
      }
    })
    .filter((value, index, values) => values.indexOf(value) === index);
  // Firebase Auth's sign-in popup/redirect uses an iframe on the project's auth domain.
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const authOrigin = authDomain ? `https://${authDomain}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com https://www.google.com https://www.gstatic.com https://apis.google.com https://translate.google.com https://translate.googleapis.com`,
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`} https://translate.google.com https://translate.googleapis.com https://fonts.googleapis.com`,
    "img-src 'self' data: blob: https://translate.google.com https://translate.googleapis.com https://www.gstatic.com",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
    `connect-src 'self' ${dev ? "ws://localhost:* ws://127.0.0.1:*" : ""} https://plausible.io https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com https://firebaseappcheck.googleapis.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://translate.google.com https://translate.googleapis.com https://challenges.cloudflare.com ${telemetryOrigins.join(" ")}`,
    `frame-src 'self' https://challenges.cloudflare.com https://www.google.com https://www.recaptcha.net https://translate.google.com ${authOrigin}`,
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
  if (production)
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
}
async function maintenanceModeEnabled(request: NextRequest): Promise<boolean> {
  try {
    const response = await fetch(new URL("/api/public/site-settings", request.url), {
      cache: "no-store",
      signal: AbortSignal.timeout(1800),
    });
    if (!response.ok) return false;
    const body: unknown = await response.json();
    if (typeof body !== "object" || body === null || !("settings" in body)) return false;
    const settings = body.settings;
    return (
      typeof settings === "object" &&
      settings !== null &&
      "maintenanceMode" in settings &&
      settings.maintenanceMode === true
    );
  } catch {
    return false; // fail open; health monitoring reports a settings outage
  }
}
function httpsRedirect(request: NextRequest, production: boolean): NextResponse | null {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (!production || (request.nextUrl.protocol === "https:" && forwardedProto !== "http"))
    return null;
  const destination = request.nextUrl.clone();
  destination.protocol = "https:";
  return NextResponse.redirect(destination, 308);
}

function originResponse(request: NextRequest, production: boolean): NextResponse | null {
  const origin = request.headers.get("origin");
  const expectedOrigin = APP_ORIGIN ?? request.nextUrl.origin;
  if (origin && !isAllowedRequestOrigin(origin, expectedOrigin, !production)) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (isMutation && request.nextUrl.pathname.startsWith("/api/") && !origin) {
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

function deniedAdminResponse(
  production: boolean,
  nonce: string,
  status: number,
  revokeSession = false,
): NextResponse {
  const denied = NextResponse.json(
    { error: "Access denied." },
    { status, headers: { "Cache-Control": "no-store" } },
  );
  if (revokeSession) {
    denied.cookies.set("sis_admin_session", "", {
      httpOnly: true,
      secure: production,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    denied.cookies.set("sis_admin_csrf", "", {
      secure: production,
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
  }
  securityHeaders(denied, nonce, production);
  return denied;
}

async function authorizeAdmin(
  request: NextRequest,
  production: boolean,
  nonce: string,
): Promise<NextResponse | null> {
  const path = request.nextUrl.pathname;
  const adminPage = isAdminPage(path) && path !== "/admin/login";
  if (!adminPage && !path.startsWith("/api/admin/")) return null;
  try {
    const guardHeaders = new Headers();
    for (const headerName of [
      "x-vercel-forwarded-for",
      "x-real-ip",
      "cf-connecting-ip",
      "x-vercel-ip-country",
      "x-vercel-ip-city",
      "cf-ipcountry",
      "cf-ipcity",
      "cookie",
      "authorization",
      "x-admin-email",
    ]) {
      const value = request.headers.get(headerName);
      if (value) guardHeaders.set(headerName, value);
    }
    guardHeaders.set("x-admin-location-guard", process.env.AUDIT_LOG_HMAC_SECRET ?? "");
    const guard = await fetch(new URL("/api/admin/location-policy/guard", request.url), {
      method: "GET",
      headers: guardHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (guard.ok) return null;
    return deniedAdminResponse(
      production,
      nonce,
      guard.status === 403 ? 403 : 503,
      guard.headers.get("x-admin-session-revoked") === "true",
    );
  } catch {
    return production ? deniedAdminResponse(production, nonce, 503) : null;
  }
}

function adminLoginRedirect(request: NextRequest, path: string): NextResponse | null {
  const adminPage = isAdminPage(path);
  if (!adminPage || path === "/admin/login" || request.cookies.get("sis_admin_session")?.value)
    return null;
  const login = request.nextUrl.clone();
  login.pathname = "/admin/login";
  login.search = "";
  login.searchParams.set("next", path);
  return NextResponse.redirect(login);
}

async function maintenanceResponse(
  request: NextRequest,
  path: string,
  production: boolean,
  nonce: string,
): Promise<NextResponse | null> {
  const isApi = path.startsWith("/api/");
  const isPageRead = !isApi && ["GET", "HEAD"].includes(request.method);
  if (
    isMaintenanceExempt(path) ||
    (!isPageRead && !isApi) ||
    !(await maintenanceModeEnabled(request))
  )
    return null;
  const blocked = isApi
    ? NextResponse.json(
        { error: "Service temporarily unavailable for maintenance." },
        { status: 503 },
      )
    : NextResponse.rewrite(new URL("/maintenance", request.url), { status: 503 });
  securityHeaders(blocked, nonce, production);
  blocked.headers.set("Retry-After", "900");
  blocked.headers.set("Cache-Control", "no-store");
  blocked.headers.set("X-Robots-Tag", "noindex, nofollow");
  return blocked;
}

function isMaintenanceExempt(path: string): boolean {
  return (
    isAdminPage(path) ||
    isMaintenanceApiExempt(path) ||
    isMaintenanceAsset(path) ||
    path === "/maintenance" ||
    path === "/offline"
  );
}

function isMaintenanceApiExempt(path: string): boolean {
  return (
    path.startsWith("/api/admin/") ||
    path === "/api/health" ||
    path.startsWith("/api/cron/") ||
    path === "/api/public/site-settings"
  );
}

function isMaintenanceAsset(path: string): boolean {
  return (
    path.startsWith("/_next/") ||
    path === "/favicon.svg" ||
    path.startsWith("/icons/") ||
    path === "/manifest.webmanifest" ||
    path === "/sw.js"
  );
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

function setResponsePolicyHeaders(response: NextResponse, request: NextRequest, path: string): void {
  if (isNoIndexPath(path) || (path === "/verify" && request.nextUrl.searchParams.size > 0)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
  }
  if (path.startsWith("/api/") || path === "/" || path.startsWith("/admin")) {
    response.headers.set("Cache-Control", "no-store, max-age=0, must-revalidate");
  }
}

export async function middleware(request: NextRequest) {
  const production = process.env.NODE_ENV === "production";
  const redirect = httpsRedirect(request, production);
  if (redirect) return redirect;
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

  const path = request.nextUrl.pathname;
  if (path === "/api/admin/location-policy/guard") return response;
  const originResult = originResponse(request, production);
  if (originResult) return originResult;
  const adminResult = await authorizeAdmin(request, production, nonce);
  if (adminResult) return adminResult;
  const loginRedirect = adminLoginRedirect(request, path);
  if (loginRedirect) return loginRedirect;
  const maintenance = await maintenanceResponse(request, path, production, nonce);
  if (maintenance) return maintenance;
  setResponsePolicyHeaders(response, request, path);
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
