import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  globalTeardown: "./e2e/responsive-teardown.ts",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "webkit-responsive",
      testMatch: "responsive.spec.ts",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  ...(process.env.PLAYWRIGHT_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...process.env,
            NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
            NEXT_PUBLIC_APPCHECK_TURNSTILE_SITE_KEY: "2x0000000000000000000000AB",
            FIREBASE_API_KEY: "e2e-api-key",
            FIREBASE_PROJECT_ID: "sis-e2e",
            FIREBASE_AUTH_DOMAIN: "sis-e2e.firebaseapp.com",
            NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:e2e",
          },
        },
      }),
});
