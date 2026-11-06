import { z } from "zod";

import { validateEnvironmentFields } from "./env-validation";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const serverEnvironmentFieldsSchema = z
  .object({
    NODE_ENV: optionalText,
    NEXT_PHASE: optionalText,
    VERCEL_ENV: optionalText,
    VERCEL_URL: optionalText,
    VERCEL_PROJECT_PRODUCTION_URL: optionalText,
    APP_ORIGIN: optionalText,
    SITE_URL: optionalText,
    ADDITIONAL_ALLOWED_ORIGINS: optionalText,
    SECURITY_CONTACT_EMAIL: optionalText,
    NEXT_PUBLIC_FIREBASE_API_KEY: optionalText,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optionalText,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: optionalText,
    NEXT_PUBLIC_FIREBASE_APP_ID: optionalText,
    FIREBASE_PROJECT_ID: optionalText,
    FIREBASE_SERVICE_ACCOUNT_BASE64: optionalText,
    FIREBASE_CLIENT_EMAIL: optionalText,
    FIREBASE_PRIVATE_KEY: optionalText,
    NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY: optionalText,
    APP_CHECK_ENFORCE: optionalText,
    R2_ACCOUNT_ID: optionalText,
    R2_ACCESS_KEY_ID: optionalText,
    R2_SECRET_ACCESS_KEY: optionalText,
    R2_BUCKET: optionalText,
    BACKUP_R2_BUCKET: optionalText,
    TURNSTILE_SECRET_KEY: optionalText,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalText,
    SEARCH_HMAC_SECRET: optionalText,
    AUDIT_LOG_HMAC_SECRET: optionalText,
    CERTIFICATE_ACCESS_TOKEN_SECRET: optionalText,
    CERTIFICATE_NUMBER_HMAC_SECRET: optionalText,
    DISAMBIGUATION_HMAC_SECRET: optionalText,
    DISAMBIGUATION_CHALLENGE_SECRET: optionalText,
    STUDENT_PII_ENCRYPTION_KEY: optionalText,
    CERTIFICATE_NUMBER_ENCRYPTION_KEY: optionalText,
    EXPORT_ENCRYPTION_KEY: optionalText,
    OTP_HMAC_SECRET: optionalText,
    GMAIL_USER: optionalText,
    GMAIL_APP_PASSWORD: optionalText,
    GMAIL_FROM_NAME: optionalText,
    CRON_SECRET: optionalText,
    UPLOADS_PER_HOUR_LIMIT: optionalText,
    UPLOADS_PER_DAY_LIMIT: optionalText,
    UPLOAD_BYTES_PER_DAY_LIMIT: optionalText,
    R2_STORAGE_BUDGET_BYTES: optionalText,
    NEXT_PUBLIC_DATA_HOSTING_REGION: optionalText,
    NEXT_PUBLIC_RETENTION_YEARS: optionalText,
    PRIVACY_POLICY_VERSION: optionalText,
    NEXT_PUBLIC_PRIVACY_POLICY_VERSION: optionalText,
    NEXT_PUBLIC_TERMS_VERSION: optionalText,
    BREACH_RESPONSE_TARGET_HOURS: optionalText,
    NOTIFICATION_OPT_OUT_SECRET: optionalText,
    CLAMD_HOST: optionalText,
    CLAMD_PORT: optionalText,
    CLAMD_TIMEOUT_MS: optionalText,
    MALWARE_SCAN_MODE: optionalText,
    SENTRY_DSN: optionalText,
    NEXT_PUBLIC_SENTRY_DSN: optionalText,
    NEXT_PUBLIC_PLAUSIBLE_DOMAIN: optionalText,
    NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL: optionalText,
    RESTORE_STAGING_PROJECT_ID: optionalText,
    RESTORE_TEST_LOG: optionalText,
    SEED_SESSIONS: optionalText,
    SEED_CERTIFICATE_TYPES: optionalText,
  })
  .loose()
;
export type ServerEnvironment = z.infer<typeof serverEnvironmentFieldsSchema>;

const serverEnvironmentSchema = serverEnvironmentFieldsSchema.superRefine(validateEnvironmentFields);

export type ServerEnvironmentResult = {
  valid: boolean;
  deployment: string;
  checks: { name: string; passed: boolean; message: string }[];
  missing: string[];
  errors: string[];
};

export function validateServerEnvironment(
  source: NodeJS.ProcessEnv | Record<string, string | undefined>,
): ServerEnvironmentResult {
  const parsed = serverEnvironmentSchema.safeParse(source);
  const deployment = source.VERCEL_ENV ?? source.NODE_ENV ?? "development";
  if (parsed.success) {
    const requiredNames = deployment === "production"
      ? [source.SITE_URL ? "SITE_URL" : source.APP_ORIGIN ? "APP_ORIGIN" : source.VERCEL_PROJECT_PRODUCTION_URL ? "VERCEL_PROJECT_PRODUCTION_URL" : "VERCEL_URL", "FIREBASE_PROJECT_ID", "R2_BUCKET", "CRON_SECRET"]
      : deployment === "preview"
        ? ["FIREBASE_PROJECT_ID", "R2_BUCKET", "GMAIL_USER", "GMAIL_APP_PASSWORD"]
        : [];
    return {
      valid: true,
      deployment,
      checks: requiredNames.length
        ? requiredNames.map((name) => ({ name, passed: true, message: "configured" }))
        : [{ name: "server environment", passed: true, message: "configuration is valid" }],
      missing: [],
      errors: [],
    };
  }
  const issues = parsed.error.issues.map((entry) => ({
    name: String(entry.path[0] ?? "environment"),
    message: entry.message,
  }));
  const unique = [...new Map(issues.map((entry) => [`${entry.name}:${entry.message}`, entry])).values()];
  return {
    valid: false,
    deployment,
    checks: unique.map((entry) => ({
      name: entry.name,
      passed: false,
      message: entry.message,
    })),
    missing: [...new Set(issues.filter((entry) => /required/i.test(entry.message)).map((entry) => entry.name))],
    errors: unique.map((entry) => `${entry.name}: ${entry.message}`),
  };
}

export function assertServerEnvironment(
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): void {
  const result = validateServerEnvironment(source);
  if (result.valid) return;
  throw new Error(
    `Invalid ${result.deployment} server environment:${
      result.missing.length ? `\nMISSING: ${result.missing.join(", ")}` : ""
    }${result.errors.length ? `\n${result.errors.map((entry) => `- ${entry}`).join("\n")}` : ""}`,
  );
}
