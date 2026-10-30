import { NextRequest, NextResponse } from "next/server";
const APP_ORIGIN = process.env.APP_ORIGIN;
function buildCsp(nonce: string): string {
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
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com https://www.google.com https://www.gstatic.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://plausible.io https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firebaseinstallations.googleapis.com https://firebaseappcheck.googleapis.com https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://challenges.cloudflare.com ${telemetryOrigins.join(" ")}`,
    "frame-src https://challenges.cloudflare.com https://www.google.com https://www.recaptcha.net",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
function securityHeaders(
  response: NextResponse,
  nonce: string,
  production: boolean,
): void {
  response.headers.set("Content-Security-Policy", buildCsp(nonce));
  response.headers.set("X-Frame-Options", "DENY");
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
export async function middleware(request: NextRequest) {
  const production = process.env.NODE_ENV === "production";
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (
    production &&
    (request.nextUrl.protocol !== "https:" || forwardedProto === "http")
  ) {
    const destination = request.nextUrl.clone();
    destination.protocol = "https:";
    return NextResponse.redirect(destination, 308);
  }
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", buildCsp(nonce));
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  securityHeaders(response, nonce, production);

  const origin = request.headers.get("origin");
  const isMutation = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const expectedOrigin = APP_ORIGIN ?? request.nextUrl.origin;
  if (origin && origin !== expectedOrigin) {
    return NextResponse.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  }
  if (isMutation && request.nextUrl.pathname.startsWith("/api/") && !origin) {
    return NextResponse.json(
      { error: "Request origin is required." },
      { status: 403 },
    );
  }
  if (request.method === "OPTIONS") {
    if (origin !== expectedOrigin)
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
  const path = request.nextUrl.pathname;
  const isAdminPath =
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/api/admin/");
  const maintenanceExempt =
    isAdminPath ||
    path === "/maintenance" ||
    path === "/offline" ||
    path === "/api/health" ||
    path.startsWith("/api/cron/") ||
    path === "/api/public/site-settings" ||
    path.startsWith("/_next/") ||
    path === "/favicon.svg" ||
    path.startsWith("/icons/") ||
    path === "/manifest.webmanifest" ||
    path === "/sw.js";
  if (
    !maintenanceExempt &&
    !path.startsWith("/api/") &&
    ["GET", "HEAD"].includes(request.method)
  ) {
    try {
      const settingsResponse = await fetch(
        new URL("/api/public/site-settings", request.url),
        { cache: "no-store", signal: AbortSignal.timeout(1800) },
      );
      const settings = settingsResponse.ok
        ? ((await settingsResponse.json()) as {
            settings?: { maintenanceMode?: boolean };
          })
        : null;
      if (settings?.settings?.maintenanceMode === true) {
        const maintenance = NextResponse.rewrite(
          new URL("/maintenance", request.url),
          { status: 503 },
        );
        securityHeaders(maintenance, nonce, production);
        maintenance.headers.set("Retry-After", "900");
        maintenance.headers.set("Cache-Control", "no-store");
        maintenance.headers.set("X-Robots-Tag", "noindex, nofollow");
        return maintenance;
      }
    } catch {
      /* fail open if settings cannot be read; health monitoring reports the outage */
    }
  }
  if (
    !maintenanceExempt &&
    path.startsWith("/api/") &&
    request.method !== "OPTIONS"
  ) {
    try {
      const settingsResponse = await fetch(
        new URL("/api/public/site-settings", request.url),
        { cache: "no-store", signal: AbortSignal.timeout(1800) },
      );
      const settings = settingsResponse.ok
        ? ((await settingsResponse.json()) as {
            settings?: { maintenanceMode?: boolean };
          })
        : null;
      if (settings?.settings?.maintenanceMode === true) {
        const unavailable = NextResponse.json(
          { error: "Service temporarily unavailable for maintenance." },
          {
            status: 503,
            headers: {
              "Retry-After": "900",
              "Cache-Control": "no-store",
              "X-Robots-Tag": "noindex, nofollow",
            },
          },
        );
        securityHeaders(unavailable, nonce, production);
        return unavailable;
      }
    } catch {
      /* fail open on settings lookup failure */
    }
  }
  if (
    path.startsWith("/api/") ||
    path === "/admin" ||
    path.startsWith("/admin/") ||
    path.startsWith("/api/certificates/search") ||
    path.startsWith("/api/certificates/") ||
    path === "/maintenance" ||
    path === "/print" ||
    path.startsWith("/print/") ||
    path === "/results" ||
    path.startsWith("/results/") ||
    (path === "/verify" && request.nextUrl.searchParams.size > 0)
  ) {
    response.headers.set(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive, nosnippet",
    );
  }
  if (
    request.nextUrl.pathname.startsWith("/api/") ||
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname.startsWith("/admin")
  ) {
    response.headers.set(
      "Cache-Control",
      "no-store, max-age=0, must-revalidate",
    );
  }
  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
