import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  verifyIdToken: vi.fn(async () => ({ uid: "admin-1", email: "admin@school.example", email_verified: true, role: "superadmin", auth_time: Math.floor(Date.now() / 1000) })),
  snapshot: { exists: true, get: (key: string) => ({
    email: "admin@school.example", role: "superadmin", status: "active", lockedUntil: 0,
    consumedAt: null, verifiedAt: null, expiresAt: new Date(Date.now() + 600_000), uid: "admin-1",
  } as Record<string, unknown>)[key] },
  requireAdmin: vi.fn(async () => ({ uid: "admin-1", role: "superadmin" })),
}));
vi.mock("server-only", () => ({}));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => new Date() } }));
vi.mock("@/server/firebase-admin", () => ({
  adminAuth: { verifyIdToken: state.verifyIdToken },
  db: {
    collection: (name: string) => ({
      doc: (_id: string) => ({
        get: async () => ({ exists: true, get: (key: string) => name === "admins" ? ({ email: "admin@school.example", role: "superadmin", status: "active" } as Record<string, unknown>)[key] : 0 }),
      }),
    }),
    runTransaction: async (callback: (transaction: { get: () => Promise<typeof state.snapshot>; update: () => void }) => Promise<unknown>) => callback({
      get: async () => state.snapshot,
      update: () => {},
    }),
  },
}));
vi.mock("@/server/security", () => ({
  verifyRequestAppCheck: vi.fn(async () => {}), sameOrigin: vi.fn(() => true),
  verifyCsrf: vi.fn(() => true), requireAdmin: state.requireAdmin,
  writeAuditLog: vi.fn(async () => {}), hashRequesterIp: vi.fn(() => "ip-hash"),
  adminSessionCookieOptions: vi.fn(() => ({})), csrfCookieOptions: vi.fn(() => ({})), createCsrfToken: vi.fn(() => "csrf"),
}));

import { NextRequest } from "next/server";

import { POST as createReauth } from "../src/app/api/admin/reauth/route";
import { POST as createSession } from "../src/app/api/admin/session/route";

function request(path: string, body: Record<string, string>): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST", headers: { origin: "http://localhost", "content-type": "application/json", cookie: "sis_admin_session=test; sis_admin_csrf=test" },
    body: JSON.stringify(body),
  });
}

describe("OTP-gated session and re-auth routes", () => {
  it("returns 403 and never creates a session without a verified OTP challenge", async () => {
    const response = await createSession(request("/api/admin/session", { idToken: "fresh-token", challengeId: "2f54c7b0-06ea-44d1-a9d2-35d66c4a99ad" }));
    expect(response.status).toBe(403);
  });

  it("rejects re-authentication without a fresh verified OTP challenge", async () => {
    const response = await createReauth(request("/api/admin/reauth", { idToken: "fresh-token", challengeId: "2f54c7b0-06ea-44d1-a9d2-35d66c4a99ad" }));
    expect(response.status).toBe(403);
  });
});
