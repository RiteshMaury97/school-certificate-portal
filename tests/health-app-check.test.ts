import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "../src/app/api/health/route";

describe("health App Check configuration status", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("reports named configuration status without returning secret values", async () => {
    vi.stubEnv("APPCHECK_TURNSTILE_SECRET_KEY", "turnstile-secret-value");
    vi.stubEnv("NEXT_PUBLIC_APPCHECK_TURNSTILE_SITE_KEY", "turnstile-site-key");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_APP_ID", "1:123456789012:web:abcdef0123456789");
    vi.stubEnv("FIREBASE_PROJECT_ID", "sis-transfer-certificate");
    vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_BASE64", "service-account-credentials");

    const response = await GET(new Request("https://tc.sischool.in/api/health"));
    const body: unknown = await response.json();

    expect(body).toMatchObject({
      appCheckConfiguration: {
        APPCHECK_TURNSTILE_SECRET_KEY: true,
        NEXT_PUBLIC_APPCHECK_TURNSTILE_SITE_KEY: true,
        NEXT_PUBLIC_FIREBASE_APP_ID: true,
        NEXT_PUBLIC_FIREBASE_APP_ID_is_web_app: true,
        FIREBASE_PROJECT_ID: true,
        FIREBASE_ADMIN_CREDENTIALS: true,
      },
    });
    expect(JSON.stringify(body)).not.toContain("turnstile-secret-value");
    expect(JSON.stringify(body)).not.toContain("service-account-credentials");
  });
});
