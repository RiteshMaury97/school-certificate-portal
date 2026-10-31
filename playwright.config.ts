import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: "http://127.0.0.1:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...process.env,
            NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
            NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY: "e2e-recaptcha-site-key",
            NEXT_PUBLIC_FIREBASE_API_KEY: "e2e-api-key",
            NEXT_PUBLIC_FIREBASE_PROJECT_ID: "sis-e2e",
            NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "sis-e2e.firebaseapp.com",
            NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:e2e",
          },
        },
      }),
});
