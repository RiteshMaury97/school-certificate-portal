import { validateServerEnvironment } from "@/server/env";

function isProduction(): boolean {
  return (
    process.env.VERCEL_ENV !== "preview" &&
    (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production")
  );
}

function originConfigErrors(): string[] {
  const result = validateServerEnvironment(process.env);
  return result.errors.filter((error) =>
    ["SITE_URL", "APP_ORIGIN", "ADDITIONAL_ALLOWED_ORIGINS"].includes(error.split(":", 1)[0] ?? ""),
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

export function getSiteOrigin(): string {
  if (process.env.VERCEL_ENV === "preview") {
    const deploymentUrl = process.env.VERCEL_URL?.trim();
    if (!deploymentUrl) throw new Error("VERCEL_URL is required for Preview deployment links.");
    return validateHttpsOrigin(`https://${deploymentUrl}`, "VERCEL_URL");
  }

  if (!isProduction()) return "http://localhost:3000";

  const errors = originConfigErrors();
  if (errors.length) throw new Error(`Invalid production origin configuration: ${errors.join("; ")}`);
  const siteUrl = process.env.SITE_URL?.trim();
  const configured = siteUrl && siteUrl.length > 0 ? siteUrl : process.env.APP_ORIGIN?.trim();
  if (!configured) {
    throw new Error(
      "SITE_URL is required in Production (APP_ORIGIN is accepted temporarily as a deprecated alias).",
    );
  }
  return validateHttpsOrigin(configured, process.env.SITE_URL ? "SITE_URL" : "APP_ORIGIN");
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
  if (isProduction()) {
    const errors = originConfigErrors();
    if (errors.length) throw new Error(`Invalid production origin configuration: ${errors.join("; ")}`);
  }
  const additional = (process.env.ADDITIONAL_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => validateHttpsOrigin(origin, "ADDITIONAL_ALLOWED_ORIGINS"));
  return [...new Set([getSiteOrigin(), ...additional])];
}
