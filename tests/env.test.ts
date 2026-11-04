import { describe, expect, it } from "vitest";

import { validateServerEnvironment } from "@/server/env";

const validProductionEnvironment = {
  NODE_ENV: "production",
  APP_ORIGIN: "https://school.example",
  SITE_URL: "https://school.example",
  NEXT_PUBLIC_FIREBASE_API_KEY: "public-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "school.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "school-prod",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:123:web:abc",
  NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY: "recaptcha-site-key",
  FIREBASE_PROJECT_ID: "school-prod",
  FIREBASE_SERVICE_ACCOUNT_BASE64: Buffer.from(
    JSON.stringify({ private_key: "private", client_email: "firebase@example.test" }),
  ).toString("base64"),
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "access",
  R2_SECRET_ACCESS_KEY: "r".repeat(32),
  R2_BUCKET: "school-certificates",
  BACKUP_R2_BUCKET: "school-backups",
  TURNSTILE_SECRET_KEY: "t".repeat(32),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site-key",
  SEARCH_HMAC_SECRET: "a".repeat(32),
  AUDIT_LOG_HMAC_SECRET: "b".repeat(32),
  CERTIFICATE_ACCESS_TOKEN_SECRET: "c".repeat(32),
  CERTIFICATE_NUMBER_HMAC_SECRET: "d".repeat(32),
  DISAMBIGUATION_HMAC_SECRET: "e".repeat(32),
  DISAMBIGUATION_CHALLENGE_SECRET: "f".repeat(32),
  STUDENT_PII_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  CERTIFICATE_NUMBER_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString("base64"),
  EXPORT_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString("base64"),
  OTP_HMAC_SECRET: "g".repeat(32),
  GMAIL_USER: "school@example.test",
  GMAIL_APP_PASSWORD: "test-app-password",
  CRON_SECRET: "h".repeat(32),
  CLAMD_HOST: "clamd.internal",
  MALWARE_SCAN_MODE: "required",
};

describe("server environment validator", () => {
  it("lists missing production variable names without exposing values", () => {
    const result = validateServerEnvironment({ NODE_ENV: "production", API_PRIVATE_VALUE: "do-not-leak" });
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("APP_ORIGIN");
    expect(JSON.stringify(result)).not.toContain("do-not-leak");
  });

  it("rejects short secrets and malformed AES base64 keys", () => {
    const result = validateServerEnvironment({
      ...validProductionEnvironment,
      SEARCH_HMAC_SECRET: "short",
      STUDENT_PII_ENCRYPTION_KEY: "not-base64-key",
    });
    expect(result.errors).toContain("SEARCH_HMAC_SECRET: must contain at least 32 bytes");
    expect(result.errors).toContain(
      "STUDENT_PII_ENCRYPTION_KEY: must be valid base64 encoding of exactly 32 bytes",
    );
  });

  it("rejects an HTTP production origin", () => {
    const result = validateServerEnvironment({
      ...validProductionEnvironment,
      APP_ORIGIN: "http://school.example",
    });
    expect(result.errors).toContain(
      "APP_ORIGIN: must be an https origin with no path or trailing slash",
    );
  });

  it("accepts a complete production environment", () => {
    expect(validateServerEnvironment(validProductionEnvironment).valid).toBe(true);
  });

  it("requires Preview to omit APP_ORIGIN and have staging service settings", () => {
    const result = validateServerEnvironment({
      VERCEL_ENV: "preview",
      APP_ORIGIN: "https://school.example",
    });
    expect(result.errors).toContain("APP_ORIGIN: must not be set for Preview deployments");
    expect(result.missing).toContain("R2_BUCKET");
  });

  it("treats Vercel Preview as Preview even though Next sets NODE_ENV to production", () => {
    const result = validateServerEnvironment({ VERCEL_ENV: "preview", NODE_ENV: "production" });
    expect(result.errors).not.toContain("APP_ORIGIN: is required");
    expect(result.errors).toContain("R2_BUCKET: is required");
  });
});
