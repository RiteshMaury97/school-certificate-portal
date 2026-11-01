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

async function maintenanceModeEnabled(request: NextRequest): Promise<boolean> {
  try {
    const response = await fetch(new URL("/api/public/site-settings", request.url), {
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

function adminLoginRedirect(request: NextRequest, path: string): NextResponse | null {
  if (!isAdminPage(path) || path === "/admin/login" || request.cookies.get("sis_admin_session")?.value)
    return null;
  const login = request.nextUrl.clone();
  login.pathname = "/admin/login";
  login.search = "";
  login.searchParams.set("next", path);
  return NextResponse.redirect(login);
}

function isMaintenanceExempt(path: string): boolean {
  return (
    isAdminPage(path) ||
    path.startsWith("/api/admin/") ||
    path === "/maintenance" ||
    path === "/offline" ||
    path === "/api/health" ||
    path.startsWith("/api/cron/") ||
    path === "/api/public/site-settings" ||
    path.startsWith("/_next/") ||
    path === "/favicon.svg" ||
    path.startsWith("/icons/") ||
    path === "/manifest.webmanifest" ||
    path === "/sw.js"
  );
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
  const login = adminLoginRedirect(request, path);
  if (login) return login;
  const maintenance = await maintenanceResponse(request, path, production, nonce);
  if (maintenance) return maintenance;
  setResponsePolicyHeaders(response, request, path);
  return response;
}

export async function middleware(request: NextRequest) {
  const production = process.env.NODE_ENV === "production";
  const redirect = httpsRedirect(request, production);
  if (redirect) return redirect;
  const { nonce, response } = createRequestResponse(request, production);
  return continueRequest(request, response, nonce, production);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
