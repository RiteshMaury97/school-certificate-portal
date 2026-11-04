import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const sendMail = vi.fn((message: unknown) => Promise.resolve(message));
  const createTransport = vi.fn(() => ({ sendMail }));
  const set = vi.fn();
  const get = vi.fn(() => Promise.resolve({ get: () => 0 }));
  const runTransaction = vi.fn(
    (callback: (transaction: { get: typeof get; set: typeof set }) => Promise<number>) =>
      callback({ get, set }),
  );
  const doc = vi.fn(() => ({}));
  const collection = vi.fn(() => ({ doc }));
  return { sendMail, createTransport, set, get, runTransaction, doc, collection };
});

vi.mock("server-only", () => ({}));
vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));
vi.mock("@/server/firebase-admin", () => ({
  db: {
    collection: mocks.collection,
    runTransaction: mocks.runTransaction,
  },
}));

import { escapeHtml, sendAdminOtpEmail, sendMail } from "../src/server/mailer";

describe("central Gmail mailer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    process.env.SITE_URL = "http://localhost:3000";
    process.env.GMAIL_USER = "school@example.com";
    process.env.GMAIL_APP_PASSWORD = "smtp-secret-not-for-logs";
    delete process.env.GMAIL_FROM_NAME;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.GMAIL_FROM_NAME;
    delete process.env.SITE_URL;
  });

  it("strips CR/LF from sender and subject headers", async () => {
    await sendMail({
      to: "parent@example.com\r\nBcc:attacker@example.com",
      subject: "Hello\r\nBcc:attacker@example.com",
      text: "Message",
    });
    const message: unknown = mocks.sendMail.mock.calls[0]?.[0];
    if (
      typeof message !== "object" ||
      message === null ||
      !("to" in message) ||
      !("subject" in message) ||
      !("from" in message) ||
      !Array.isArray(message.to) ||
      typeof message.subject !== "string" ||
      typeof message.from !== "string"
    ) {
      throw new Error("Expected sendMail to receive a mail message");
    }
    expect(message.to).toEqual(["parent@example.com Bcc:attacker@example.com"]);
    expect(message.subject).toBe("Hello Bcc:attacker@example.com");
    expect(message.from).not.toContain("\r");
    expect(message.from).not.toContain("\n");
  });

  it("HTML-escapes interpolated content", () => {
    expect(escapeHtml(`<script>"x" & 'y'</script>`)).toBe(
      "&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;",
    );
  });

  it("escapes school name and OTP in the HTML template", async () => {
    await sendAdminOtpEmail({
      to: "admin@example.com",
      code: "012345",
      schoolName: `<School & "Friends">`,
    });
    const message: unknown = mocks.sendMail.mock.calls[0]?.[0];
    if (
      typeof message !== "object" ||
      message === null ||
      !("html" in message) ||
      typeof message.html !== "string"
    ) {
      throw new Error("Expected sendMail to receive an HTML message");
    }
    expect(message.html).toContain("&lt;School &amp; &quot;Friends&quot;&gt;");
    expect(message.html).toContain("012345");
    expect(message.html).toContain("expires in");
    expect(message.html).toContain("5 minutes");
    expect(message.html).toContain("will never ask you to share it");
    expect(message.html).toContain("resetting your password");
  });

  it("throws a clear error when Gmail credentials are missing", async () => {
    delete process.env.GMAIL_USER;
    await expect(sendMail({
      to: "parent@example.com",
      subject: "Test",
      text: "Test",
    })).rejects.toThrow(/GMAIL_USER/);
  });

  it("uses the development OTP fallback without logging SMTP secrets", async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => null);
    await sendAdminOtpEmail({
      to: "admin@example.com",
      code: "012345",
      schoolName: "School",
    });
    const logged = warning.mock.calls.flat().join(" ");
    expect(logged).toContain("012345");
    expect(logged).not.toContain("smtp-secret-not-for-logs");
  });

  it("does not use the development fallback in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", "https://mail-test.example");
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => null);
    await expect(sendAdminOtpEmail({
      to: "admin@example.com",
      code: "012345",
      schoolName: "School",
    })).rejects.toThrow(/GMAIL_USER/);
    expect(warning).not.toHaveBeenCalled();
  });

});

describe("email link origin independence", () => {
  afterEach(() => {
    vi.doUnmock("@/server/site-origin");
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("keeps OTP and invitation links on the configured portal origin", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("GMAIL_USER", "sender@gmail.com");
    vi.stubEnv("GMAIL_APP_PASSWORD", "test-password");
    vi.doMock("@/server/site-origin", () => ({
      absoluteUrl: (path: string) => `https://new-school.example${path}`,
    }));
    vi.resetModules();
    const mailer = await import("../src/server/mailer");
    const verificationLink = `https://sis-e2e.firebaseapp.com/action?continueUrl=${encodeURIComponent("https://new-school.example/admin/login")}`;

    await mailer.sendAdminOtpEmail({
      to: "admin@example.net",
      code: "012345",
      schoolName: "School",
    });
    await mailer.sendAdminInvitationEmail({
      to: "admin@example.net",
      role: "admin",
      temporaryPassword: "temporary-secret",
      verificationLink,
      schoolName: "School",
    });

    const messages = mocks.sendMail.mock.calls.map((call) => call[0]);
    const rendered = JSON.stringify(messages);
    expect(rendered).toContain("https://new-school.example/admin/login");
    expect(rendered).toContain("cid:sis-logo@school-portal");
    expect(rendered).not.toContain("sischool.in");
    expect(rendered).not.toContain("old-school.example");
    const senders = messages.map((message) =>
      typeof message === "object" && message !== null && "from" in message ? message.from : "",
    );
    expect(senders.every((from) => typeof from === "string" && from.endsWith("<sender@gmail.com>"))).toBe(true);
  });
});
