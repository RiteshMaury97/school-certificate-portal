import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const adminAuth = {
    generatePasswordResetLink: vi.fn((_email: string, action: { url: string }) =>
      Promise.resolve(`https://sis-e2e.firebaseapp.com/action?mode=resetPassword&continueUrl=${encodeURIComponent(action.url)}`),
    ),
  };
  return {
    adminAuth,
    sendMail: vi.fn((message: unknown) => Promise.resolve(message)),
    verifyRequestAppCheck: vi.fn(() => Promise.resolve()),
    sameOrigin: vi.fn(() => true),
    getCachedSiteSettings: vi.fn(() => Promise.resolve({})),
  };
});

vi.mock("@/server/firebase-admin", () => ({ adminAuth: mocks.adminAuth }));
vi.mock("@/server/mailer", () => ({
  escapeHtml: (value: string) => value,
  sendMail: mocks.sendMail,
}));
vi.mock("@/server/security", () => ({
  sameOrigin: mocks.sameOrigin,
  verifyRequestAppCheck: mocks.verifyRequestAppCheck,
}));
vi.mock("@/server/site-settings-cache", () => ({
  getCachedSiteSettings: mocks.getCachedSiteSettings,
}));

const script = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../scripts/check-domain-independence.mjs",
);
const configuredOrigin = "https://new-school.example";

function useProductionOrigin() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SITE_URL", configuredOrigin);
  vi.stubEnv("APP_ORIGIN", "");
  vi.stubEnv("ADDITIONAL_ALLOWED_ORIGINS", "");
  vi.stubEnv("SECURITY_CONTACT_EMAIL", "security@new-school.example");
}

async function runAgainst(content: string) {
  const root = await mkdtemp(path.join(os.tmpdir(), "domain-independence-"));
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src", "probe.ts"), content);
  const result = spawnSync(process.execPath, [script], {
    encoding: "utf8",
    env: { ...process.env, DOMAIN_INDEPENDENCE_ROOT: root },
  });
  await rm(root, { recursive: true, force: true });
  return result;
}

function canonicalMetadataBase(value: string | URL | null | undefined): URL {
  if (value instanceof URL) return value;
  return new URL(typeof value === "string" ? value : "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function firstOpenGraphImageUrl(value: unknown): string {
  if (!isRecord(value) || !("images" in value)) return "";
  const images = value.images;
  const image = Array.isArray(images) ? images[0] : images;
  if (typeof image === "string") return image;
  if (image instanceof URL) return image.toString();
  if (isRecord(image) && "url" in image) {
    const url = image.url;
    if (url instanceof URL) return url.toString();
    if (typeof url === "string") return url;
  }
  return "";
}

describe("domain independence static check", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    useProductionOrigin();
    mocks.getCachedSiteSettings.mockResolvedValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects the retired and example fallback domains", async () => {
    const result = await runAgainst("https://sischool.in https://example.org");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("retired sischool.in domain");
    expect(result.stderr).toContain("example.org fallback");
  }, 20_000);

  it("rejects unapproved hosts and permits allowlisted third-party services", async () => {
    const rejected = await runAgainst("https://school.test");
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain('hard-coded HTTPS host "school.test"');

    const accepted = await runAgainst("https://challenges.cloudflare.com https://apis.google.com");
    expect(accepted.status).toBe(0);
  }, 20_000);

  it("passes the checked-in application and deployment files", () => {
    expect(() => execFileSync(process.execPath, [script], { stdio: "pipe" })).not.toThrow();
  }, 20_000);

  it("uses the configured origin for robots, sitemap, metadata, and security.txt", async () => {
    const [{ default: robots }, { default: sitemap }, { generateMetadata }, securityRoute] =
      await Promise.all([
        import("@/app/robots"),
        import("@/app/sitemap"),
        import("@/app/layout"),
        import("@/app/.well-known/security.txt/route"),
      ]);
    const robotEntry = robots();
    const sitemapEntries = sitemap();
    const metadata = await generateMetadata();
    const securityResponse = await securityRoute.GET();
    const securityBody = await securityResponse.text();

    expect(robotEntry.sitemap).toBe(`${configuredOrigin}/sitemap.xml`);
    expect(sitemapEntries.length).toBeGreaterThan(0);
    expect(sitemapEntries.map((entry) => new URL(entry.url).origin)).toEqual(
      sitemapEntries.map(() => configuredOrigin),
    );
    expect(sitemapEntries.map((entry) => new URL(entry.url).pathname)).toEqual(
      expect.arrayContaining(["/", "/terms", "/privacy"]),
    );
    const metadataBase = canonicalMetadataBase(metadata.metadataBase);
    expect(metadataBase.origin).toBe(configuredOrigin);
    expect(metadata.alternates?.canonical).toBe("/");
    expect(new URL(firstOpenGraphImageUrl(metadata.openGraph), metadataBase).origin).toBe(configuredOrigin);
    expect(securityBody).toContain(`Canonical: ${configuredOrigin}/.well-known/security.txt`);
    expect(securityBody).toContain(`Policy: ${configuredOrigin}/privacy`);
    expect(securityBody).not.toContain("sischool.in");
  });

  it("generates all email link paths from the configured origin", async () => {
    const { absoluteUrl } = await import("@/server/site-origin");
    const paths = [
      "/admin/login",
      "/sis-logo.png",
      "/api/admin/session/revoke-all?token=action-token",
      "/",
      "/api/public/notifications/opt-out?token=opt-out-token",
      "/admin/breaches",
    ];
    const generated = paths.map((path) => absoluteUrl(path));
    expect(generated.every((link) => new URL(link).origin === configuredOrigin)).toBe(true);
    expect(generated.join("\n")).not.toContain("sischool.in");
    expect(generated.join("\n")).not.toContain("old-school.example");
  });

  it("does not let spoofed request host headers change password-reset links", async () => {
    const { POST } = await import("@/app/api/admin/password-reset/route");
    const request = new NextRequest("https://old-school.example/api/admin/password-reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Host: "spoofed-host.invalid",
        Origin: "https://spoofed-origin.invalid",
        "x-forwarded-host": "forwarded-host.invalid",
      },
      body: JSON.stringify({ email: "admin@new-school.example" }),
    });

    const response = await POST(request);
    const email = mocks.sendMail.mock.calls[0]?.[0];
    const emailContent = JSON.stringify(email);
    const actionSettings = mocks.adminAuth.generatePasswordResetLink.mock.calls[0]?.[1];
    const continueUrl = new URL(actionSettings?.url ?? "");

    expect(response.status).toBe(200);
    expect(continueUrl.origin).toBe(configuredOrigin);
    expect(decodeURIComponent(emailContent)).toContain(configuredOrigin);
    expect(emailContent).not.toContain("old-school.example");
    expect(emailContent).not.toContain("spoofed-host.invalid");
    expect(emailContent).not.toContain("spoofed-origin.invalid");
    expect(emailContent).not.toContain("forwarded-host.invalid");
  });

  it("fails clearly in production when SITE_URL is missing or not HTTPS", async () => {
    const { getSiteOrigin } = await import("@/server/site-origin");
    vi.stubEnv("SITE_URL", "");
    expect(() => getSiteOrigin()).toThrow(/SITE_URL: is required in Production/);
    vi.stubEnv("SITE_URL", "http://new-school.example");
    expect(() => getSiteOrigin()).toThrow(/SITE_URL.*https origin/i);
  });
});
