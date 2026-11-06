import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  environmentError: new Error("Invalid production server environment: FIREBASE_PROJECT_ID is required"),
  verifyRequestAppCheck: vi.fn(() => Promise.resolve()),
  describeFirebaseError: vi.fn((error: unknown) =>
    error instanceof Error ? error.message : "unknown Firebase error",
  ),
}));

vi.mock("server-only", () => ({}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => new Date() },
  Timestamp: Object,
}));
vi.mock("@/server/firebase-admin", () => ({
  adminAuth: new Proxy({}, { get: () => { throw mocks.environmentError; } }),
  adminAppCheck: new Proxy({}, { get: () => { throw mocks.environmentError; } }),
  db: new Proxy({}, { get: () => { throw mocks.environmentError; } }),
  describeFirebaseError: mocks.describeFirebaseError,
}));
vi.mock("@/server/admin-location", () => ({ enforceAdminLocation: vi.fn() }));
vi.mock("@/server/admin-otp", () => ({ consumeVerifiedAdminOtpChallenge: vi.fn() }));
vi.mock("@/server/mailer", () => ({ escapeHtml: (value: string) => value, sendMail: vi.fn() }));
vi.mock("@/server/request-origin", () => ({
  getRequestOrigin: vi.fn(() => ({ ip: null, country: null, city: null })),
  requesterIp: vi.fn(() => "203.0.113.1"),
}));
vi.mock("@/server/security", () => ({
  adminSessionCookieOptions: () => ({}),
  createCsrfToken: () => "csrf",
  csrfCookieOptions: () => ({}),
  hashRequesterIp: () => "ip-hash",
  sameOrigin: () => true,
  verifyCsrf: () => true,
  verifyRequestAppCheck: mocks.verifyRequestAppCheck,
  writeAuditLog: vi.fn(),
}));
vi.mock("@/server/site-origin", () => ({ absoluteUrl: (path: string) => `https://school.example${path}` }));

import { GET } from "../src/app/api/admin/session/route";

describe("admin session route configuration failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthenticated without initializing Firebase when no session cookie exists", async () => {
    const response = await GET(new NextRequest("https://school.example/api/admin/session"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
    expect(mocks.verifyRequestAppCheck).not.toHaveBeenCalled();
    expect(mocks.describeFirebaseError).not.toHaveBeenCalled();
  });

  it("returns safe JSON when Firebase initialization throws an environment error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new NextRequest("https://school.example/api/admin/session", {
      headers: { cookie: "sis_admin_session=present" },
    });

    const response = await GET(request);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      authenticated: false,
      error: "The server is not configured correctly. Contact the site owner.",
    });
    expect(mocks.describeFirebaseError).toHaveBeenCalledWith(mocks.environmentError);
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});
