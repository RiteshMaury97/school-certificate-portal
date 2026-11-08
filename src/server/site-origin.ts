function isProduction(): boolean {
  return (
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.VERCEL_ENV !== "preview" &&
    (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production")
  );
}

function validateHttpsOrigin(value: string, name: string): string {
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
  if (isValidHttpsOrigin(siteUrl)) return siteUrl;
  if (isValidHttpsOrigin(appOrigin)) return appOrigin;
  if (vercelHost) {
    try {
      return validateHttpsOrigin(`https://${vercelHost}`, "VERCEL_PROJECT_PRODUCTION_URL");
    } catch {
      // Keep rendering available; startup environment validation reports the bad setting.
    }
  }
  // This non-routable fallback keeps metadata and redirects from crashing the app.
  // Production environment validation logs the missing or malformed origin.
  return "https://localhost.invalid";
}

function previewOrigin(): string {
  const deploymentUrl = trimmedEnvironmentValue("VERCEL_URL");
  if (deploymentUrl) {
    try {
      return validateHttpsOrigin(`https://${deploymentUrl}`, "VERCEL_URL");
    } catch {
      // Continue with a safe fallback and report the invalid value at startup.
    }
  }
  return "https://localhost.invalid";
}

export function getSiteOrigin(): string {
  // Next evaluates layout metadata while collecting routes, before the Vercel
  // deployment URL is available to Preview builds.
  if (process.env.NEXT_PHASE === "phase-production-build") return "http://localhost:3000";
  if (process.env.VERCEL_ENV === "preview") return previewOrigin();
  return isProduction() ? productionOrigin() : "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  const origin = getSiteOrigin();
  const url = new URL(path, `${origin}/`);
  if (url.origin !== origin) {
    throw new Error("absoluteUrl path must resolve to the configured site origin.");
  }
  return url.toString();
}

export function getAllowedOrigins(): string[] {
  const additional = (process.env.ADDITIONAL_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .filter((origin) => isValidHttpsOrigin(origin));
  return [...new Set([getSiteOrigin(), ...additional])];
}
