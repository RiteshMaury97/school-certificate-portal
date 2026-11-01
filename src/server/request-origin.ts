import "server-only";
import { createHmac } from "node:crypto";

export type RequestLike = { headers: Headers };
export type RequestOrigin = { ip: string | null; country: string | null; city: string | null };
export type RequestOriginOptions = {
  production?: boolean;
  trustCloudflareProxy?: boolean;
};

function firstHeaderValue(headers: Headers, name: string): string | null {
  const value = headers.get(name)?.split(",", 1)[0]?.trim();
  return value && value.length > 0 ? value : null;
}

function nonEmptyHeader(headers: Headers, name: string): string | null {
  const value = headers.get(name)?.trim();
  return value && value.length > 0 ? value : null;
}

function trustedIp(headers: Headers, trustCloudflareProxy: boolean): string | null {
  return (
    firstHeaderValue(headers, "x-vercel-forwarded-for") ??
    firstHeaderValue(headers, "x-real-ip") ??
    (trustCloudflareProxy ? firstHeaderValue(headers, "cf-connecting-ip") : null)
  );
}

/** Reads only trusted edge headers. Options are injectable for unit tests. */
export function getRequestOrigin(
  request: RequestLike,
  options: RequestOriginOptions = {},
): RequestOrigin {
  const production = options.production ?? process.env.NODE_ENV === "production";
  const trustCloudflareProxy =
    options.trustCloudflareProxy ?? process.env.TRUST_CLOUDFLARE_PROXY === "true";
  const headers = request.headers;
  const ip = trustedIp(headers, trustCloudflareProxy) ?? (production ? null : "127.0.0.1");
  const country =
    nonEmptyHeader(headers, "x-vercel-ip-country") ??
    (trustCloudflareProxy ? nonEmptyHeader(headers, "cf-ipcountry") : null);
  const city =
    nonEmptyHeader(headers, "x-vercel-ip-city") ??
    (trustCloudflareProxy ? nonEmptyHeader(headers, "cf-ipcity") : null);
  return { ip, country, city };
}

export function requesterIp(request: RequestLike, options?: RequestOriginOptions): string | null {
  return getRequestOrigin(request, options).ip;
}

export function requireRequesterIp(request: RequestLike, options?: RequestOriginOptions): string {
  const ip = requesterIp(request, options);
  if (!ip) throw new Error("TRUSTED_CLIENT_IP_UNAVAILABLE");
  return ip;
}

export function hashRequestIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip, "utf8").digest("hex");
}
