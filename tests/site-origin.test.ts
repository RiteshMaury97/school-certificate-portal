import { afterEach, describe, expect, it, vi } from "vitest";

import { absoluteUrl, getAllowedOrigins, getSiteOrigin } from "@/server/site-origin";

function setEnv(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) vi.stubEnv(name, value);
}

describe("site origin configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses localhost in development and resolves relative links", () => {
    setEnv({ NODE_ENV: "development", VERCEL_ENV: undefined, SITE_URL: undefined, APP_ORIGIN: undefined });
    expect(getSiteOrigin()).toBe("http://localhost:3000");
    expect(absoluteUrl("/admin/login")).toBe("http://localhost:3000/admin/login");
  });

  it("does not allow a link path to override the configured origin", () => {
    setEnv({ NODE_ENV: "development", VERCEL_ENV: undefined, SITE_URL: undefined, APP_ORIGIN: undefined });
    expect(() => absoluteUrl("//untrusted.example/path")).toThrow(/configured site origin/);
  });

  it("uses the deployment hostname in Preview", () => {
    setEnv({ VERCEL_ENV: "preview", VERCEL_URL: "preview-123.vercel.app" });
    expect(getSiteOrigin()).toBe("https://preview-123.vercel.app");
  });

  it("requires a valid Production canonical origin and accepts the legacy alias", () => {
    setEnv({ NODE_ENV: "production", VERCEL_ENV: "production", SITE_URL: undefined, APP_ORIGIN: undefined });
    expect(() => getSiteOrigin()).toThrow(/SITE_URL: is required in Production/);

    setEnv({ SITE_URL: "https://school.example/path" });
    expect(() => getSiteOrigin()).toThrow(/no path/);

    setEnv({ SITE_URL: undefined, APP_ORIGIN: "https://school.example" });
    expect(getSiteOrigin()).toBe("https://school.example");
  });

  it("accepts configured migration origins without changing canonical links", () => {
    setEnv({
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      SITE_URL: "https://new.school.example",
      APP_ORIGIN: undefined,
      ADDITIONAL_ALLOWED_ORIGINS: "https://old.school.example, https://legacy.school.example",
    });
    expect(getAllowedOrigins()).toEqual([
      "https://new.school.example",
      "https://old.school.example",
      "https://legacy.school.example",
    ]);
    expect(absoluteUrl("/privacy")).toBe("https://new.school.example/privacy");
  });
});
