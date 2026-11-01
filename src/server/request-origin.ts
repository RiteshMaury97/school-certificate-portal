import { createHmac } from "node:crypto";

type HeaderRequest = { headers: Headers };

export class TrustedRequesterIpUnavailable extends Error {
  constructor() {
    super("A trusted client IP address is unavailable.");
    this.name = "TrustedRequesterIpUnavailable";
  }
}

function cloudflareProxyTrusted(): boolean {
  return process.env.TRUST_CLOUDFLARE_PROXY === "true";
}

function header(request: HeaderRequest, name: string): string | null {
  const value = request.headers.get(name)?.trim();
  return value && value.length > 0 ? value : null;
}

export function requesterIp(request: HeaderRequest): string | null {
  const vercelForwardedFor = header(request, "x-vercel-forwarded-for");
  if (vercelForwardedFor) {
    const firstIp = vercelForwardedFor.split(",", 1)[0]?.trim();
    if (firstIp) return firstIp;
  }

  const realIp = header(request, "x-real-ip");
  if (realIp) return realIp;

  if (cloudflareProxyTrusted()) {
    const cloudflareIp = header(request, "cf-connecting-ip");
    if (cloudflareIp) return cloudflareIp;
  }

  return process.env.NODE_ENV === "production" ? null : "127.0.0.1";
}

export function requireRequesterIp(request: HeaderRequest): string {
  const ip = requesterIp(request);
  if (!ip) throw new TrustedRequesterIpUnavailable();
  return ip;
}

export function hasTrustedRequesterIp(request: HeaderRequest): boolean {
  return requesterIp(request) !== null;
}

export function hashRequesterIp(request: HeaderRequest): string {
  const secret = process.env.AUDIT_LOG_HMAC_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("AUDIT_LOG_HMAC_SECRET must be configured with at least 32 bytes");
  }
  return createHmac("sha256", secret).update(requireRequesterIp(request), "utf8").digest("hex");
}

export function requesterCountry(request: HeaderRequest): string {
  return (
    header(request, "x-vercel-ip-country") ??
    (cloudflareProxyTrusted() ? header(request, "cf-ipcountry") : null) ??
    ""
  );
}

export function requesterCity(request: HeaderRequest): string {
  return (
    header(request, "x-vercel-ip-city") ??
    (cloudflareProxyTrusted() ? header(request, "cf-ipcity") : null) ??
    ""
  );
}
