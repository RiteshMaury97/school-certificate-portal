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
  });
});
