import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCachedSiteSettings } = vi.hoisted(() => ({ getCachedSiteSettings: vi.fn() }));

vi.mock("@/server/site-settings-cache", () => ({ getCachedSiteSettings }));
vi.mock("@/server/site-origin", () => ({
  getSafeSiteOrigin: () => "https://school.example",
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-nonce": "test-nonce" }) }));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("@/components/providers/AppProviders", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/ui/toast", () => ({ Toaster: () => null }));

import RootLayout, { generateMetadata } from "@/app/layout";

describe("root layout resilience", () => {
  beforeEach(() => {
    getCachedSiteSettings.mockReset();
  });

  it("renders and generates fallback metadata when Firestore site settings fail", async () => {
    getCachedSiteSettings.mockRejectedValue(new Error("Firestore unavailable"));

    await expect(generateMetadata()).resolves.toMatchObject({
      title: { default: expect.any(String) },
      description: expect.any(String),
    });
    await expect(RootLayout({ children: null })).resolves.toBeTruthy();
  });
});
