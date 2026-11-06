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
    expect(response.headers.get("Content-Security-Policy")).toBeTruthy();
  });
});
