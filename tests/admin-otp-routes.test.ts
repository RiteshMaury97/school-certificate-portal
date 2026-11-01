import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as createReauth } from "../src/app/api/admin/reauth/route";
import { POST as createSession } from "../src/app/api/admin/session/route";

const state = vi.hoisted(() => {
  const snapshotFields: Record<string, unknown> = {
    email: "admin@school.example",
    role: "superadmin",
    status: "active",
    lockedUntil: 0,
    consumedAt: null,
    verifiedAt: null,
    expiresAt: new Date(Date.now() + 600_000),
    uid: "admin-1",
  };
  return {
    verifyIdToken: vi.fn(() =>
      Promise.resolve({
        uid: "admin-1",
        email: "admin@school.example",
        email_verified: true,
        role: "superadmin",
        auth_time: Math.floor(Date.now() / 1000),
      }),
    ),
    snapshot: {
      exists: true,
      get: (key: string) => snapshotFields[key],
    },
    requireAdmin: vi.fn(() => Promise.resolve({ uid: "admin-1", role: "superadmin" })),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => new Date() },
}));
vi.mock("@/server/firebase-admin", () => ({
  describeFirebaseError: () => "Firebase test error",
  adminAuth: { verifyIdToken: state.verifyIdToken },
  db: {
    collection: (name: string) => ({
      doc: () => ({
        get: () =>
          Promise.resolve({
            exists: true,
            get: (key: string) => {
              const fields: Record<string, unknown> = {
                email: "admin@school.example",
                role: "superadmin",
                status: "active",
              };
              return name === "admins" ? fields[key] : 0;
            },
          }),
      }),
    }),
    runTransaction: (
      callback: (transaction: {
        get: () => Promise<typeof state.snapshot>;
        update: () => boolean;
      }) => Promise<unknown>,
    ) =>
      callback({
        get: () => Promise.resolve(state.snapshot),
        update: () => true,
      }),
  },
}));
vi.mock("@/server/request-origin", () => ({
  hasTrustedRequesterIp: vi.fn(() => true),
  requesterCity: vi.fn(() => "Test city"),
  requesterCountry: vi.fn(() => "IN"),
}));
vi.mock("@/server/admin-location", () => ({
  enforceAdminLocation: vi.fn(() => Promise.resolve()),
}));
vi.mock("@/server/security", () => ({
  verifyRequestAppCheck: vi.fn(() => Promise.resolve()),
  sameOrigin: vi.fn(() => true),
  verifyCsrf: vi.fn(() => true),
  requireAdmin: state.requireAdmin,
  writeAuditLog: vi.fn(() => Promise.resolve()),
  hashRequesterIp: vi.fn(() => "ip-hash"),
  adminSessionCookieOptions: vi.fn(() => ({})),
  csrfCookieOptions: vi.fn(() => ({})),
  createCsrfToken: vi.fn(() => "csrf"),
}));

function request(path: string, body: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      cookie: "sis_admin_session=test; sis_admin_csrf=test",
    },
    body: JSON.stringify(body),
  });
}

describe("OTP-gated session and re-auth routes", () => {
  beforeEach(() => {
    vi.stubEnv("AUDIT_LOG_HMAC_SECRET", "test-secret-which-is-longer-than-32-bytes");
    vi.stubEnv("OTP_HMAC_SECRET", "otp-test-secret-which-is-longer-than-32-bytes");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 403 and never creates a session without a verified OTP challenge", async () => {
    const response = await createSession(
      request("/api/admin/session", {
        idToken: "fresh-token",
        challengeId: "2f54c7b0-06ea-44d1-a9d2-35d66c4a99ad",
      }),
    );
    expect(response.status).toBe(403);
  });

  it("rejects re-authentication without a fresh verified OTP challenge", async () => {
    const response = await createReauth(
      request("/api/admin/reauth", {
        idToken: "fresh-token",
        challengeId: "2f54c7b0-06ea-44d1-a9d2-35d66c4a99ad",
      }),
    );
    expect(response.status).toBe(403);
  });
});
