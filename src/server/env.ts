import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const serverEnvironmentSchema = z
  .object({
    NODE_ENV: optionalText,
    NEXT_PHASE: optionalText,
    VERCEL_ENV: optionalText,
    APP_ORIGIN: optionalText,
    SITE_URL: optionalText,
    NEXT_PUBLIC_SITE_URL: optionalText,
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
  .passthrough()
  .superRefine((env, context) => {
    const production = env.VERCEL_ENV
      ? env.VERCEL_ENV === "production"
      : env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";
    const preview = env.VERCEL_ENV === "preview";
    const issue = (name: string, message: string) =>
      context.addIssue({ code: "custom", path: [name], message });
    const requireNames = (names: string[]) => {
      for (const name of names) if (!env[name as keyof typeof env]) issue(name, "is required");
    };

    const secretNames = [
      "SEARCH_HMAC_SECRET",
      "AUDIT_LOG_HMAC_SECRET",
      "CERTIFICATE_ACCESS_TOKEN_SECRET",
      "CERTIFICATE_NUMBER_HMAC_SECRET",
      "DISAMBIGUATION_HMAC_SECRET",
      "DISAMBIGUATION_CHALLENGE_SECRET",
      "OTP_HMAC_SECRET",
      "NOTIFICATION_OPT_OUT_SECRET",
      "CRON_SECRET",
      "R2_SECRET_ACCESS_KEY",
      "TURNSTILE_SECRET_KEY",
      "FIREBASE_PRIVATE_KEY",
    ] as const;
    for (const name of secretNames) {
      const value = env[name];
      if (value && Buffer.byteLength(value, "utf8") < 32)
        issue(name, "must contain at least 32 bytes");
    }

    const base64KeyNames = [
      "STUDENT_PII_ENCRYPTION_KEY",
      "CERTIFICATE_NUMBER_ENCRYPTION_KEY",
      "EXPORT_ENCRYPTION_KEY",
    ] as const;
    for (const name of base64KeyNames) {
      const value = env[name];
      if (!value) continue;
      const decoded = Buffer.from(value, "base64");
      if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value) || decoded.length !== 32)
        issue(name, "must be valid base64 encoding of exactly 32 bytes");
    }

    const serviceAccount = env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (serviceAccount) {
      const decoded = Buffer.from(serviceAccount, "base64");
      let validServiceAccount = false;
      try {
        const parsed: unknown = JSON.parse(decoded.toString("utf8"));
        validServiceAccount =
          typeof parsed === "object" && parsed !== null &&
          ("private_key" in parsed || "privateKey" in parsed) &&
          ("client_email" in parsed || "clientEmail" in parsed);
      } catch {
        validServiceAccount = false;
      }
      if (decoded.length === 0 || !validServiceAccount)
        issue("FIREBASE_SERVICE_ACCOUNT_BASE64", "must encode Firebase service-account JSON");
    }

    const hasFirebaseCredentials = Boolean(
      serviceAccount || (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY),
    );
    if (env.FIREBASE_CLIENT_EMAIL && !env.FIREBASE_PRIVATE_KEY)
      issue("FIREBASE_PRIVATE_KEY", "is required when FIREBASE_CLIENT_EMAIL is set");
    if (env.FIREBASE_PRIVATE_KEY && !env.FIREBASE_CLIENT_EMAIL)
      issue("FIREBASE_CLIENT_EMAIL", "is required when FIREBASE_PRIVATE_KEY is set");
    if (env.MALWARE_SCAN_MODE && !["required", "off"].includes(env.MALWARE_SCAN_MODE))
      issue("MALWARE_SCAN_MODE", "must be required or off");
    if (env.APP_CHECK_ENFORCE && !["true", "false"].includes(env.APP_CHECK_ENFORCE))
      issue("APP_CHECK_ENFORCE", "must be true or false");
    for (const name of ["CLAMD_PORT", "CLAMD_TIMEOUT_MS"] as const) {
      const value = env[name];
      if (value && (!Number.isInteger(Number(value)) || Number(value) <= 0))
        issue(name, "must be a positive integer");
    }

    const httpsOrigin = (value: string | undefined) => {
      if (!value) return false;
      try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" && parsed.origin === value;
      } catch {
        return false;
      }
    };
    const allowedOrigin = (value: string | undefined) => {
      if (httpsOrigin(value)) return true;
      if (!value || production || preview) return false;
      try {
        const parsed = new URL(value);
        return (
          parsed.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
          parsed.origin === value
        );
      } catch {
        return false;
      }
    };

    if (env.APP_ORIGIN && !allowedOrigin(env.APP_ORIGIN))
      issue("APP_ORIGIN", "must be an https origin with no path or trailing slash");
    if (env.SITE_URL && !allowedOrigin(env.SITE_URL))
      issue("SITE_URL", "must be an https origin with no path or trailing slash");
    if (env.NEXT_PUBLIC_SITE_URL) {
      if (!allowedOrigin(env.NEXT_PUBLIC_SITE_URL))
        issue("NEXT_PUBLIC_SITE_URL", "must be an https origin (or local development origin)");
    }

    if (preview) {
      if (env.APP_ORIGIN) issue("APP_ORIGIN", "must not be set for Preview deployments");
      requireNames([
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_APP_ID",
        "NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY",
        "FIREBASE_PROJECT_ID",
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
        "GMAIL_USER",
        "GMAIL_APP_PASSWORD",
        "TURNSTILE_SECRET_KEY",
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
        "SEARCH_HMAC_SECRET",
        "AUDIT_LOG_HMAC_SECRET",
        "CERTIFICATE_ACCESS_TOKEN_SECRET",
        "CERTIFICATE_NUMBER_HMAC_SECRET",
        "DISAMBIGUATION_HMAC_SECRET",
        "DISAMBIGUATION_CHALLENGE_SECRET",
        "STUDENT_PII_ENCRYPTION_KEY",
        "CERTIFICATE_NUMBER_ENCRYPTION_KEY",
        "OTP_HMAC_SECRET",
        "CLAMD_HOST",
        "MALWARE_SCAN_MODE",
      ]);
      if (!hasFirebaseCredentials)
        issue("FIREBASE_SERVICE_ACCOUNT_BASE64", "Preview requires staging Firebase Admin credentials");
    }

    if (production) {
      requireNames([
        "APP_ORIGIN",
        "SITE_URL",
        "NEXT_PUBLIC_FIREBASE_API_KEY",
        "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
        "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
        "NEXT_PUBLIC_FIREBASE_APP_ID",
        "NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY",
        "FIREBASE_PROJECT_ID",
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
        "BACKUP_R2_BUCKET",
        "TURNSTILE_SECRET_KEY",
        "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
        "SEARCH_HMAC_SECRET",
        "AUDIT_LOG_HMAC_SECRET",
        "CERTIFICATE_ACCESS_TOKEN_SECRET",
        "CERTIFICATE_NUMBER_HMAC_SECRET",
        "DISAMBIGUATION_HMAC_SECRET",
        "DISAMBIGUATION_CHALLENGE_SECRET",
        "STUDENT_PII_ENCRYPTION_KEY",
        "CERTIFICATE_NUMBER_ENCRYPTION_KEY",
        "EXPORT_ENCRYPTION_KEY",
        "OTP_HMAC_SECRET",
        "GMAIL_USER",
        "GMAIL_APP_PASSWORD",
        "CRON_SECRET",
        "CLAMD_HOST",
        "MALWARE_SCAN_MODE",
      ]);
      if (!hasFirebaseCredentials)
        issue("FIREBASE_SERVICE_ACCOUNT_BASE64", "Production requires Firebase Admin credentials");
      if (env.MALWARE_SCAN_MODE && env.MALWARE_SCAN_MODE !== "required")
        issue("MALWARE_SCAN_MODE", "must be required in Production");
      if (httpsOrigin(env.APP_ORIGIN) && httpsOrigin(env.SITE_URL) && env.APP_ORIGIN !== env.SITE_URL)
        issue("SITE_URL", "must exactly match APP_ORIGIN in Production");
      if (env.BACKUP_R2_BUCKET && env.R2_BUCKET && env.BACKUP_R2_BUCKET === env.R2_BUCKET)
        issue("BACKUP_R2_BUCKET", "must be different from R2_BUCKET");
    }
  });

export type ServerEnvironmentResult = {
  valid: boolean;
  deployment: string;
  checks: Array<{ name: string; passed: boolean; message: string }>;
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
      ? ["APP_ORIGIN", "SITE_URL", "FIREBASE_PROJECT_ID", "R2_BUCKET", "CRON_SECRET", "CLAMD_HOST", "MALWARE_SCAN_MODE"]
      : deployment === "preview"
        ? ["FIREBASE_PROJECT_ID", "R2_BUCKET", "GMAIL_USER", "GMAIL_APP_PASSWORD", "CLAMD_HOST", "MALWARE_SCAN_MODE"]
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
