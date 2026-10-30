import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("empty and error state contracts", () => {
  it("exposes reusable EmptyState and retryable ErrorState APIs", async () => {
    const empty = await readFile("src/components/EmptyState.tsx", "utf8");
    const error = await readFile("src/components/feedback/ErrorState.tsx", "utf8");
    for (const prop of ["icon", "title", "description", "action"]) expect(empty).toContain(prop);
    expect(empty).toContain("No data found");
    expect(error).toContain("onRetry");
    expect(error).toContain("Retry");
    expect(error).toContain('role="alert"');
  });

  it("disables certificate lookup when no published sessions exist", async () => {
    const source = await readFile("src/screens/FinderPage.tsx", "utf8");
    expect(source).toContain(
      "disabled={sessionsLoading || sessionsLoadError || sessions.length === 0}",
    );
    expect(source).toContain('"No data found"');
    expect(source).toContain("No published sessions are currently available");
    expect(source).toContain("No record found. Check the details and try again.");
  });

  it("fails closed when Turnstile is unavailable and uses the Cloudflare test key in development", async () => {
    const source = await readFile("src/screens/FinderPage.tsx", "utf8");
    const verify = await readFile("src/screens/VerifyPage.tsx", "utf8");
    for (const content of [source, verify]) {
      expect(content).toContain("1x00000000000000000000AA");
      expect(content).toContain("Security check could not load");
      expect(content).toContain("!captchaToken");
    }
  });

  it("separates FAQ network failures from an empty FAQ collection", async () => {
    const source = await readFile("src/screens/FaqPage.tsx", "utf8");
    expect(source).toContain("loadError");
    expect(source).toContain("ErrorState");
    expect(source).toContain("EmptyState");
    expect(source).toContain("No data found");
  });

  it("does not render an empty principal message or blank social links", async () => {
    const shell = await readFile("src/components/SiteShell.tsx", "utf8");
    const footer = await readFile("src/components/layout/Footer.tsx", "utf8");
    expect(shell).toContain("settings.principalMessage?.trim()");
    expect(footer).toContain("visibleSocialLinks");
    expect(footer).toContain("lastUpdated?.trim()");
  });

  it("uses an actionable empty state for the admin student list", async () => {
    const admin = await readFile("src/screens/AdminPage.tsx", "utf8");
    expect(admin).toContain('title="No data found"');
    expect(admin).toContain("Add student");
    expect(admin).toContain("student-create-form");
  });
});
