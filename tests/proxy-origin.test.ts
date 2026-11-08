import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "../src/proxy";

describe("proxy origin checks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows a logged-out session check when the production origin is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");

    const response = await proxy(
      new NextRequest("https://school-certificate-portal.vercel.app/api/admin/session"),
    );

    expect(response.status).toBe(200);
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toMatch(/style-src 'self' 'nonce-[^']+' https:\/\/fonts\.googleapis\.com/);
    expect(csp).toMatch(/style-src-elem 'self' 'nonce-[^']+' https:\/\/fonts\.googleapis\.com/);
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toMatch(/connect-src[^;]*\bdata:/);
    expect(csp).not.toContain("firebaseappcheck.googleapis.com");
    expect(csp).not.toMatch(/script-src[^;]*\*/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-eval'/);
  });

  it("uses nonces instead of script hashes and allows the configured Plausible origin", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PLAUSIBLE_SCRIPT_URL", "https://analytics.example/js/script.js");
    vi.stubEnv("BROWSER_SENTRY_DSN", "https://sentry.example/123");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");

    const response = await proxy(
      new NextRequest("https://school-certificate-portal.vercel.app/api/admin/session"),
    );
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    const scriptSource = /\bscript-src\s+([^;]+)/i.exec(csp)?.[1] ?? "";

    expect(scriptSource).toMatch(/'nonce-[^']+'/);
    expect(scriptSource).toContain("https://analytics.example");
    expect(scriptSource).not.toContain("https://sentry.example");
    expect(scriptSource).not.toContain("https://vercel.live");
    expect(scriptSource).not.toContain("'sha256-");
    expect(scriptSource).not.toContain("'unsafe-inline'");
    expect(scriptSource).not.toContain("'unsafe-eval'");
  });

  it("returns a safe configuration response when a session request needs an invalid origin config", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", "invalid-origin");
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");

    const response = await proxy(
      new NextRequest("https://school-certificate-portal.vercel.app/api/admin/session", {
        headers: {
          cookie: "sis_admin_session=present",
          origin: "https://school-certificate-portal.vercel.app",
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "The server is not configured correctly. Contact the site owner.",
    });
  });
});
