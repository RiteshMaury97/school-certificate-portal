import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCachedSiteSettings: vi.fn(),
  absoluteUrl: vi.fn((path: string) => `https://portal.example${path}`),
}));

vi.mock("@/server/site-settings-cache", () => ({
  getCachedSiteSettings: mocks.getCachedSiteSettings,
}));
vi.mock("@/server/site-origin", () => ({
  absoluteUrl: mocks.absoluteUrl,
}));

import { GET } from "@/app/.well-known/security.txt/route";

describe("generated security.txt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("SECURITY_CONTACT_EMAIL", "");
    mocks.getCachedSiteSettings.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the security address in site settings and generates absolute policy links", async () => {
    mocks.getCachedSiteSettings.mockResolvedValue({
      securityContactEmail: "security@school.example",
    });
    vi.stubEnv("SECURITY_CONTACT_EMAIL", "fallback@school.example");
    const now = Date.now();

    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("Contact: mailto:security@school.example");
    expect(body).not.toContain("fallback@school.example");
    expect(body).toContain("Canonical: https://portal.example/.well-known/security.txt");
    expect(body).toContain("Policy: https://portal.example/privacy");
    const expiry = new Date(/^Expires: (.+)$/m.exec(body)?.[1] ?? "").getTime();
    expect(expiry).toBeGreaterThan(now + 364 * 24 * 60 * 60 * 1000);
    expect(expiry).toBeLessThan(now + 367 * 24 * 60 * 60 * 1000);
  });

  it("uses the general site contact and then environment fallback", async () => {
    mocks.getCachedSiteSettings.mockResolvedValue({ email: "office@school.example" });
    vi.stubEnv("SECURITY_CONTACT_EMAIL", "security@fallback.example");

    const settingsResponse = await GET();
    expect(await settingsResponse.text()).toContain("Contact: mailto:office@school.example");

    mocks.getCachedSiteSettings.mockResolvedValue({});
    const environmentResponse = await GET();
    expect(await environmentResponse.text()).toContain("Contact: mailto:security@fallback.example");
  });

  it("returns an explicit unavailable response when no contact is configured", async () => {
    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.text()).toContain("Security contact is not configured.");
  });
});
