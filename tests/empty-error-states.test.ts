import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("empty and error state contracts", () => {
  it("exposes reusable EmptyState and retryable ErrorState APIs", async () => {
    const empty = await readFile("src/components/feedback/EmptyState.tsx", "utf8");
    const error = await readFile("src/components/feedback/ErrorState.tsx", "utf8");
    for (const prop of ["icon", "title", "description", "action"]) expect(empty).toContain(prop);
    expect(empty).toContain("No data found");
    expect(error).toContain("onRetry");
    expect(error).toContain("Retry");
    expect(error).toContain('role="alert"');
  });

  it("disables certificate lookup when no published sessions exist", async () => {
    const source = await readFile("src/features/certificates/FinderView.tsx", "utf8");
    expect(source).toContain(
      "disabled={sessionsLoading || sessionsLoadError || sessions.length === 0}",
    );
    expect(source).toContain('"No data found"');
    expect(source).toContain("No active academic sessions are available");
    expect(source).toContain("No record found. Check the details and try again.");
  });

  it("fails closed when Turnstile is unavailable and uses the Cloudflare test key in development", async () => {
    const source = await readFile("src/features/certificates/FinderView.tsx", "utf8");
    const verify = await readFile("src/features/verify/VerifyView.tsx", "utf8");
    for (const content of [source, verify]) {
      expect(content).toContain("1x00000000000000000000AA");
      expect(content).toContain("Security check could not load");
      expect(content).toContain("!captchaToken");
    }
  });

  it("separates FAQ network failures from an empty FAQ collection", async () => {
    const source = await readFile("src/features/faq/FaqView.tsx", "utf8");
    expect(source).toContain("loadError");
    expect(source).toContain("ErrorState");
    expect(source).toContain("EmptyState");
    expect(source).toContain('title="No matching questions"');
  });

  it("does not render an empty principal message or blank social links", async () => {
    const shell = await readFile("src/components/layout/SiteShell.tsx", "utf8");
    const footer = await readFile("src/components/layout/Footer.tsx", "utf8");
    expect(shell).toContain("settings.principalMessage?.trim()");
    expect(footer).toContain("visibleSocialLinks");
    expect(footer).toContain("lastUpdated?.trim()");
  });

  it("uses an actionable empty state for the admin student list", async () => {
    const list = await readFile("src/features/admin/components/students/StudentsList.tsx", "utf8");
    const form = await readFile(
      "src/features/admin/components/students/StudentCreatePanel.tsx",
      "utf8",
    );
    expect(list).toContain('title={search ? "No matching students" : "No students yet"}');
    expect(list).toContain("Add student");
    expect(form).toContain("student-create-form");
  });

  it("does not expose the retired retention queue as an admin empty state", async () => {
    const source = await readFile("src/features/admin/AdminConsole.tsx", "utf8");
    expect(source).not.toContain("RetentionTab");
    expect(source).not.toContain("retentionRecords");
  });
});
