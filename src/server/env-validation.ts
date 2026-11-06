import { z } from "zod";

import type { ServerEnvironment } from "./env";

type AddIssue = (name: string, message: string) => void;

export const PRODUCTION_REQUIRED_ENV_NAMES = [
  "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID", "NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY", "FIREBASE_PROJECT_ID",
  "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "BACKUP_R2_BUCKET",
  "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "SEARCH_HMAC_SECRET", "AUDIT_LOG_HMAC_SECRET",
  "CERTIFICATE_ACCESS_TOKEN_SECRET", "CERTIFICATE_NUMBER_HMAC_SECRET", "DISAMBIGUATION_HMAC_SECRET",
  "DISAMBIGUATION_CHALLENGE_SECRET", "STUDENT_PII_ENCRYPTION_KEY", "CERTIFICATE_NUMBER_ENCRYPTION_KEY",
  "EXPORT_ENCRYPTION_KEY", "OTP_HMAC_SECRET", "GMAIL_USER", "GMAIL_APP_PASSWORD", "CRON_SECRET",
  "CLAMD_HOST", "MALWARE_SCAN_MODE",
] as const;

function requireNames(env: ServerEnvironment, issue: AddIssue, names: readonly string[]) {
  for (const name of names) if (!env[name]) issue(name, "is required");
}

function validateSecrets(env: ServerEnvironment, issue: AddIssue) {
  const secretNames = [
    "SEARCH_HMAC_SECRET", "AUDIT_LOG_HMAC_SECRET", "CERTIFICATE_ACCESS_TOKEN_SECRET",
    "CERTIFICATE_NUMBER_HMAC_SECRET", "DISAMBIGUATION_HMAC_SECRET",
    "DISAMBIGUATION_CHALLENGE_SECRET", "OTP_HMAC_SECRET", "NOTIFICATION_OPT_OUT_SECRET",
    "CRON_SECRET", "R2_SECRET_ACCESS_KEY", "TURNSTILE_SECRET_KEY", "FIREBASE_PRIVATE_KEY",
  ] as const;
  for (const name of secretNames) {
    const value = env[name];
    if (value && Buffer.byteLength(value, "utf8") < 32) issue(name, "must contain at least 32 bytes");
  }
  validateEncryptionKeys(env, issue);
  validateServiceAccount(env, issue);
  validateCredentialPair(env, issue);
  validateScalarSettings(env, issue);
}

function validateEncryptionKeys(env: ServerEnvironment, issue: AddIssue) {
  const names = ["STUDENT_PII_ENCRYPTION_KEY", "CERTIFICATE_NUMBER_ENCRYPTION_KEY", "EXPORT_ENCRYPTION_KEY"] as const;
  for (const name of names) {
    const value = env[name];
    if (!value) continue;
    const decoded = Buffer.from(value, "base64");
    if (decoded.toString("base64") !== value || decoded.length !== 32)
      issue(name, "must be valid base64 encoding of exactly 32 bytes");
  }
}

function isFirebaseServiceAccount(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    return typeof parsed === "object" && parsed !== null &&
      ("private_key" in parsed || "privateKey" in parsed) &&
      ("client_email" in parsed || "clientEmail" in parsed);
  } catch {
    return false;
  }
}

function validateServiceAccount(env: ServerEnvironment, issue: AddIssue) {
  const value = env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!value) return;
  if (Buffer.from(value, "base64").length === 0 || !isFirebaseServiceAccount(value))
    issue("FIREBASE_SERVICE_ACCOUNT_BASE64", "must encode Firebase service-account JSON");
}

function validateCredentialPair(env: ServerEnvironment, issue: AddIssue) {
  if (env.FIREBASE_CLIENT_EMAIL && !env.FIREBASE_PRIVATE_KEY)
    issue("FIREBASE_PRIVATE_KEY", "is required when FIREBASE_CLIENT_EMAIL is set");
  if (env.FIREBASE_PRIVATE_KEY && !env.FIREBASE_CLIENT_EMAIL)
    issue("FIREBASE_CLIENT_EMAIL", "is required when FIREBASE_PRIVATE_KEY is set");
  if (env.MALWARE_SCAN_MODE && !["required", "off"].includes(env.MALWARE_SCAN_MODE))
    issue("MALWARE_SCAN_MODE", "must be required or off");
  if (env.APP_CHECK_ENFORCE && !["true", "false"].includes(env.APP_CHECK_ENFORCE))
    issue("APP_CHECK_ENFORCE", "must be true or false");
}

function validateScalarSettings(env: ServerEnvironment, issue: AddIssue) {
  for (const name of ["CLAMD_PORT", "CLAMD_TIMEOUT_MS"] as const) {
    const value = env[name];
    if (value && (!Number.isInteger(Number(value)) || Number(value) <= 0))
      issue(name, "must be a positive integer");
  }
}

function isHttpsOrigin(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.origin === value;
  } catch {
    return false;
  }
}

function isAllowedOrigin(value: string | undefined, production: boolean, preview: boolean): boolean {
  if (isHttpsOrigin(value)) return true;
  if (!value || production || preview) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
      (parsed.origin === value || `${parsed.origin}/` === value) &&
      parsed.search === "" && parsed.hash === "";
  } catch {
    return false;
  }
}

function validateOrigins(
  env: ServerEnvironment,
  issue: AddIssue,
  production: boolean,
  preview: boolean,
) {
  if (
    env.APP_ORIGIN && !env.SITE_URL && !env.VERCEL_PROJECT_PRODUCTION_URL && !env.VERCEL_URL &&
    !isAllowedOrigin(env.APP_ORIGIN, production, preview)
  )
    issue("APP_ORIGIN", "must be an https origin with no path or trailing slash");
  if (env.SITE_URL && !isAllowedOrigin(env.SITE_URL, production, preview))
    issue("SITE_URL", "must be an https origin with no path or trailing slash");
  if (env.ADDITIONAL_ALLOWED_ORIGINS) {
    const origins = env.ADDITIONAL_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim());
    if (origins.some((origin) => !origin || !isHttpsOrigin(origin)))
      issue("ADDITIONAL_ALLOWED_ORIGINS", "must be a comma-separated list of https origins with no path or trailing slash");
  }
  if (env.SECURITY_CONTACT_EMAIL && !z.email().safeParse(env.SECURITY_CONTACT_EMAIL).success)
    issue("SECURITY_CONTACT_EMAIL", "must be a valid email address");
}

function hasFirebaseCredentials(env: ServerEnvironment): boolean {
  return Boolean(env.FIREBASE_SERVICE_ACCOUNT_BASE64 ?? (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY));
}

function validatePreview(env: ServerEnvironment, issue: AddIssue) {
  if (env.APP_ORIGIN) issue("APP_ORIGIN", "must not be set for Preview deployments");
  requireNames(env, issue, [
    "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID", "FIREBASE_PROJECT_ID",
    "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "GMAIL_USER",
    "GMAIL_APP_PASSWORD", "TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "SEARCH_HMAC_SECRET",
    "AUDIT_LOG_HMAC_SECRET", "CERTIFICATE_ACCESS_TOKEN_SECRET", "CERTIFICATE_NUMBER_HMAC_SECRET",
    "DISAMBIGUATION_HMAC_SECRET", "DISAMBIGUATION_CHALLENGE_SECRET", "STUDENT_PII_ENCRYPTION_KEY",
    "CERTIFICATE_NUMBER_ENCRYPTION_KEY", "OTP_HMAC_SECRET",
  ]);
  if (!hasFirebaseCredentials(env))
    issue("FIREBASE_SERVICE_ACCOUNT_BASE64", "Preview requires staging Firebase Admin credentials");
}

function validateProductionOrigin(env: ServerEnvironment, issue: AddIssue) {
  if (!env.SITE_URL && !env.APP_ORIGIN && !env.VERCEL_PROJECT_PRODUCTION_URL && !env.VERCEL_URL)
    issue("SITE_URL", "is required in Production (APP_ORIGIN is a deprecated alias)");
}

function validateProductionCredentials(env: ServerEnvironment, issue: AddIssue) {
  if (!hasFirebaseCredentials(env))
    issue("FIREBASE_SERVICE_ACCOUNT_BASE64", "Production requires Firebase Admin credentials");
}

function validateProductionMalwareMode(env: ServerEnvironment, issue: AddIssue) {
  if (env.MALWARE_SCAN_MODE && env.MALWARE_SCAN_MODE !== "required")
    issue("MALWARE_SCAN_MODE", "must be required in Production");
}

function validateProductionBuckets(env: ServerEnvironment, issue: AddIssue) {
  if (env.BACKUP_R2_BUCKET && env.R2_BUCKET && env.BACKUP_R2_BUCKET === env.R2_BUCKET)
    issue("BACKUP_R2_BUCKET", "must be different from R2_BUCKET");
}

function validateProductionRelationships(env: ServerEnvironment, issue: AddIssue) {
  validateProductionOrigin(env, issue);
  validateProductionCredentials(env, issue);
  validateProductionMalwareMode(env, issue);
  validateProductionBuckets(env, issue);
}

function validateProduction(env: ServerEnvironment, issue: AddIssue) {
  requireNames(env, issue, PRODUCTION_REQUIRED_ENV_NAMES);
  validateProductionRelationships(env, issue);
}

export function validateEnvironmentFields(env: ServerEnvironment, context: z.RefinementCtx) {
  // Next collects route/page data during `next build` with VERCEL_ENV still set
  // to "production". Validate deployment-only settings when the server starts,
  // not while build-time modules are being evaluated.
  const isProductionBuild = env.NEXT_PHASE === "phase-production-build";
  if (isProductionBuild) return;

  const production = env.VERCEL_ENV
    ? env.VERCEL_ENV === "production"
    : env.NODE_ENV === "production";
  const preview = env.VERCEL_ENV === "preview";
  const issue: AddIssue = (name, message) => {
    context.addIssue({ code: "custom", path: [name], message });
  };
  validateSecrets(env, issue);
  validateOrigins(env, issue, production, preview);
  if (preview) validatePreview(env, issue);
  if (production) validateProduction(env, issue);
}
