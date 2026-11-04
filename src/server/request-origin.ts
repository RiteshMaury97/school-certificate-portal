export type RequestLike = { headers: Headers };
export type RequestOrigin = { ip: string | null; country: string | null; city: string | null };
export type RequestOriginOptions = { production?: boolean };

function firstHeaderValue(headers: Headers, name: string): string | null {
  const value = headers.get(name)?.split(",", 1)[0]?.trim();
  return value && value.length > 0 ? value : null;
}

function nonEmptyHeader(headers: Headers, name: string): string | null {
  const value = headers.get(name)?.trim();
  return value && value.length > 0 ? value : null;
}

function trustedIp(headers: Headers): string | null {
  return firstHeaderValue(headers, "x-vercel-forwarded-for");
}

/** Reads only trusted edge headers. Options are injectable for unit tests. */
export function getRequestOrigin(
  request: RequestLike,
  options: RequestOriginOptions = {},
): RequestOrigin {
  const production = options.production ?? process.env.NODE_ENV === "production";
  const headers = request.headers;
  const ip = trustedIp(headers) ?? (production ? null : "127.0.0.1");
  const country = nonEmptyHeader(headers, "x-vercel-ip-country");
  const city = null;
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
