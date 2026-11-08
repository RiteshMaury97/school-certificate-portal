function isProduction(): boolean {
  return (
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.VERCEL_ENV !== "preview" &&
    (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production")
  );
}

/**
 * Tolerates common copy/paste mistakes in origin settings (surrounding quotes or spaces, a missing
 * "https://", a trailing slash, upper-case letters). Values that still carry a path, query,
 * credentials, a non-HTTPS scheme or a dot-less host are returned unchanged so validation rejects them.
 */
function normalizeOriginInput(value: string): string {
  const trimmed = value.trim().replace(/^["']+|["']+$/g, "").trim();
  if (!trimmed) return value;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    const bareOrigin =
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (url.pathname === "/" || url.pathname === "") &&
      /^[^.]+\.[^.]+/.test(url.hostname);
    return bareOrigin ? url.origin : value;
  } catch {
    return value;
  }
}

function validateHttpsOrigin(input: string, name: string): string {
  const value = normalizeOriginInput(input);
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:" && parsed.origin === value) return parsed.origin;
  } catch {
    // Use the same actionable configuration error below for malformed URLs.
  }
  throw new Error(`${name} must be an HTTPS origin with no path, query, or trailing slash.`);
}

function trimmedEnvironmentValue(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  return value;
}

function isValidHttpsOrigin(value: string | undefined): value is string {
  if (!value) return false;
  try {
    validateHttpsOrigin(value, "origin");
    return true;
  } catch {
    return false;
  }
}

function productionOrigin(): string {
  const siteUrl = trimmedEnvironmentValue("SITE_URL");
  const appOrigin = trimmedEnvironmentValue("APP_ORIGIN");
  const vercelHost = trimmedEnvironmentValue("VERCEL_PROJECT_PRODUCTION_URL") ??
    trimmedEnvironmentValue("VERCEL_URL");
  const configured = (isValidHttpsOrigin(siteUrl) ? siteUrl : undefined) ??
    (isValidHttpsOrigin(appOrigin) ? appOrigin : undefined) ??
    (vercelHost ? `https://${vercelHost}` : undefined);
  if (!configured) {
    if (siteUrl) return validateHttpsOrigin(siteUrl, "SITE_URL");
    if (appOrigin) return validateHttpsOrigin(appOrigin, "APP_ORIGIN");
    throw new Error("SITE_URL: is required in Production (APP_ORIGIN is a deprecated alias)");
  }
  const name = isValidHttpsOrigin(siteUrl) ? "SITE_URL" : isValidHttpsOrigin(appOrigin)
    ? "APP_ORIGIN"
    : "VERCEL_PROJECT_PRODUCTION_URL";
  return validateHttpsOrigin(configured, name);
}

function previewOrigin(): string {
  const deploymentUrl = trimmedEnvironmentValue("VERCEL_URL");
  if (!deploymentUrl) throw new Error("VERCEL_URL is required for Preview deployment links.");
  return validateHttpsOrigin(`https://${deploymentUrl}`, "VERCEL_URL");
}

export function getSiteOrigin(): string {
  // Next evaluates layout metadata while collecting routes, before the Vercel
  // deployment URL is available to Preview builds.
  if (process.env.NEXT_PHASE === "phase-production-build") return "http://localhost:3000";
  if (process.env.VERCEL_ENV === "preview") return previewOrigin();
  return isProduction() ? productionOrigin() : "http://localhost:3000";
}

/** Origin for metadata generation; keep non-essential canonical metadata from breaking page rendering. */
export function getSafeSiteOrigin(): string {
  try {
    return getSiteOrigin();
  } catch (error) {
    console.error(
      `[site origin] ${error instanceof Error ? error.message : "Invalid site origin configuration"}`,
    );
    const deploymentHost = trimmedEnvironmentValue("VERCEL_PROJECT_PRODUCTION_URL") ??
      trimmedEnvironmentValue("VERCEL_URL");
    if (deploymentHost) {
      try {
        return validateHttpsOrigin(`https://${deploymentHost}`, "VERCEL_PROJECT_PRODUCTION_URL");
      } catch {
        // Fall back below; startup validation reports the invalid setting by name.
      }
    }
    return "http://localhost:3000";
  }
}

export function absoluteUrl(path: string): string {
  const origin = getSiteOrigin();
  const url = new URL(path, `${origin}/`);
  if (url.origin !== origin) {
    throw new Error("absoluteUrl path must resolve to the configured site origin.");
  }
  return url.toString();
}

export function getAllowedOrigins(requestOrigin?: string | null): string[] {
  const additional = (process.env.ADDITIONAL_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin) => isValidHttpsOrigin(origin))
    .map((origin) => validateHttpsOrigin(origin, "ADDITIONAL_ALLOWED_ORIGINS"));
  let site: string;
  try {
    site = getSiteOrigin();
  } catch (error) {
    // Last resort for a live Vercel Production deployment whose SITE_URL/APP_ORIGIN are unset or
    // unusable: trust only the origin of the request's own host, and log loudly so it gets fixed.
    const fallback =
      process.env.VERCEL_ENV === "production" && isValidHttpsOrigin(requestOrigin ?? undefined)
        ? validateHttpsOrigin(requestOrigin as string, "request origin")
        : null;
    if (!fallback) throw error;
    console.error(
      "[site origin] Falling back to the request origin. Set SITE_URL to your https origin (for example https://tc.sischool.in, no path or trailing slash) in Vercel Production and redeploy.",
      error instanceof Error ? error.message : error,
    );
    site = fallback;
  }
  return [...new Set([site, ...additional])];
}
