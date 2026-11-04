import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCachedSiteSettings: vi.fn(),
  getSiteOrigin: vi.fn(() => "https://portal.example"),
}));

vi.mock("@/server/site-settings-cache", () => ({
  getCachedSiteSettings: mocks.getCachedSiteSettings,
}));
vi.mock("@/server/site-origin", () => ({
  getSiteOrigin: mocks.getSiteOrigin,
}));

import { GET } from "@/app/api/public/site-settings/route";

describe("public site identity endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCachedSiteSettings.mockResolvedValue({});
  });

  it("returns website and contact addresses from site settings", async () => {
    mocks.getCachedSiteSettings.mockResolvedValue({
      website: "https://school.example",
      email: "office@school.example",
      grievanceOfficerEmail: "grievance@school.example",
      securityContactEmail: "security@school.example",
    });

    const response = await GET();
    const body = await response.text();

    expect(body).toContain('"website":"https://school.example/"');
    expect(body).toContain('"email":"office@school.example"');
    expect(body).toContain('"grievanceOfficerEmail":"grievance@school.example"');
    expect(body).toContain('"securityContactEmail":"security@school.example"');
  });

  it("uses the origin helper as the website fallback and rejects invalid settings", async () => {
    mocks.getCachedSiteSettings.mockResolvedValue({
      website: "http://insecure.example",
      email: "invalid",
      grievanceOfficerEmail: "invalid",
      securityContactEmail: "invalid",
    });

    const response = await GET();
    const body = await response.text();

    expect(body).toContain('"website":"https://portal.example"');
    expect(body).toContain('"email":""');
    expect(body).toContain('"grievanceOfficerEmail":""');
    expect(body).toContain('"securityContactEmail":""');
  });

  it("reports settings lookup failures explicitly", async () => {
    const error = new Error("Firestore unavailable");
    const log = vi.spyOn(console, "error").mockImplementation((...args) => {
      expect(args).toEqual(["[site-settings] Could not load public site settings.", error]);
    });
    mocks.getCachedSiteSettings.mockRejectedValue(error);

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Unable to load public site settings." });
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});
