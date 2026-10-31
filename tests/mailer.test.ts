import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const sendMail = vi.fn(async (..._args: unknown[]) => {});
  const createTransport = vi.fn(() => ({ sendMail }));
  const set = vi.fn();
  const get = vi.fn(async () => ({ get: () => 0 }));
  const runTransaction = vi.fn(async (callback: (transaction: {
    get: typeof get;
    set: typeof set;
  }) => Promise<number>) => callback({ get, set }));
  const doc = vi.fn(() => ({ }));
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
  });

  it("strips CR/LF from sender and subject headers", async () => {
    await sendMail({
      to: "parent@example.com\r\nBcc:attacker@example.com",
      subject: "Hello\r\nBcc:attacker@example.com",
      text: "Message",
    });
    const message = mocks.sendMail.mock.calls[0]?.[0] as {
      to: string[];
      subject: string;
      from: string;
    };
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
    const message = mocks.sendMail.mock.calls[0]?.[0] as { html?: string };
    expect(message.html).toContain("&lt;School &amp; &quot;Friends&quot;&gt;");
    expect(message.html).toContain("012345");
    expect(message.html).toContain("valid for 10 minutes");
    expect(message.html).toContain("Never share this code");
    expect(message.html).toContain("reset your password");
  });

  it("throws a clear error when Gmail credentials are missing", async () => {
    delete process.env.GMAIL_USER;
    await expect(sendMail({
      to: "parent@example.com",
      subject: "Test",
      text: "Test",
    })).rejects.toThrow(/GMAIL_USER and GMAIL_APP_PASSWORD/);
  });

  it("uses the development OTP fallback without logging SMTP secrets", async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
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
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(sendAdminOtpEmail({
      to: "admin@example.com",
      code: "012345",
      schoolName: "School",
    })).rejects.toThrow(/GMAIL_USER and GMAIL_APP_PASSWORD/);
    expect(warning).not.toHaveBeenCalled();
  });
});
