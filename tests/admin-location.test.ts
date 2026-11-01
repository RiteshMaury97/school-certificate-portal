import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settings: {
    allowedAdminCountries: ["IN"],
    adminIpAllowlist: [],
    adminLocationEnforcementMode: "block",
    adminLocationExceptions: [] as unknown[],
  },
  auditAdd: vi.fn((event: Record<string, unknown>) => Promise.resolve(event)),
  sessionSet: vi.fn((patch: Record<string, unknown>, options: { merge: boolean }) =>
    Promise.resolve({ patch, options }),
  ),
  sendMail: vi.fn(() => Promise.resolve()),
}));

vi.mock("server-only", () => ({}));
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => new Date() } }));
vi.mock("@/server/firebase-admin", () => ({
  db: {
    collection: (name: string) => ({
      doc: () => ({
        get: () =>
          Promise.resolve({
            data: () => (name === "siteSettings" ? mocks.settings : {}),
            get: (key: string) => (key === "email" ? "admin@school.test" : null),
          }),
        set: mocks.sessionSet,
      }),
      add: mocks.auditAdd,
    }),
  },
}));
vi.mock("@/server/mailer", () => ({
  escapeHtml: (value: string) => value,
  sendMail: mocks.sendMail,
}));

import {
  type AdminSessionDocument,
  enforceAdminLocation,
  hashLocationIp,
  ipMatchesCidr,
  isAdminLocationAllowed,
  normalizeAdminLocationPolicy,
} from "../src/server/admin-location";

const request = (headers: Record<string, string>) => ({ headers: new Headers(headers) });
const blockPolicy = normalizeAdminLocationPolicy({
  allowedAdminCountries: ["IN"],
  adminIpAllowlist: [],
  adminLocationEnforcementMode: "block",
});

describe("admin location policy", () => {
  beforeEach(() => {
    vi.stubEnv("AUDIT_LOG_HMAC_SECRET", "test-audit-secret-with-at-least-32-bytes");
    mocks.settings = {
      allowedAdminCountries: ["IN"],
      adminIpAllowlist: [],
      adminLocationEnforcementMode: "block",
      adminLocationExceptions: [],
    };
    vi.clearAllMocks();
  });

  it("allows a country in the configured policy and blocks a disallowed country", () => {
    expect(isAdminLocationAllowed({ policy: blockPolicy, country: "IN", ip: "203.0.113.10" })).toBe(
      true,
    );
    expect(isAdminLocationAllowed({ policy: blockPolicy, country: "US", ip: "203.0.113.10" })).toBe(
      false,
    );
  });

  it("allows a matching IP CIDR outside the country list", () => {
    const policy = normalizeAdminLocationPolicy({
      ...blockPolicy,
      adminIpAllowlist: ["203.0.113.0/24"],
    });
    expect(ipMatchesCidr("203.0.113.12", "203.0.113.0/24")).toBe(true);
    expect(isAdminLocationAllowed({ policy, country: "US", ip: "203.0.113.12" })).toBe(true);
  });

  it("ignores expired break-glass exceptions", () => {
    const policy = normalizeAdminLocationPolicy({
      ...blockPolicy,
      adminLocationExceptions: [
        {
          id: "old",
          country: "US",
          expiresAt: "2026-01-01T00:00:00.000Z",
          reason: "Travel",
          addedBy: "root",
          createdAt: "2025-12-25T00:00:00.000Z",
        },
      ],
    });
    expect(
      isAdminLocationAllowed({
        policy,
        country: "US",
        ip: null,
        now: Date.parse("2026-02-01T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("limits an administrator exception to its target admin", () => {
    const policy = normalizeAdminLocationPolicy({
      ...blockPolicy,
      adminLocationExceptions: [
        {
          id: "temporary-admin",
          adminUid: "admin-1",
          expiresAt: "2026-12-01T00:00:00.000Z",
          reason: "Approved travel",
          addedBy: "root",
          createdAt: "2026-11-01T00:00:00.000Z",
        },
      ],
    });
    const now = Date.parse("2026-11-02T00:00:00.000Z");
    expect(
      isAdminLocationAllowed({ policy, country: "US", ip: null, adminUid: "admin-1", now }),
    ).toBe(true);
    expect(
      isAdminLocationAllowed({ policy, country: "US", ip: null, adminUid: "admin-2", now }),
    ).toBe(false);
  });

  it("revokes and emails when an existing session changes country", async () => {
    const sessionRef: AdminSessionDocument = {
      id: "session-hash",
      set: mocks.sessionSet,
    };
    const result = await enforceAdminLocation({
      request: request({ "x-vercel-ip-country": "US", "x-vercel-forwarded-for": "203.0.113.12" }),
      adminUid: "admin-1",
      sessionCountry: "IN",
      sessionRef,
    });
    expect(result).toMatchObject({ allowed: false, reason: "country_changed", country: "US" });
    expect(mocks.sessionSet).toHaveBeenCalledWith(
      expect.objectContaining({ revokeReason: "country_changed" }),
      { merge: true },
    );
    expect(mocks.auditAdd).toHaveBeenCalledOnce();
    const event = mocks.auditAdd.mock.calls[0]?.[0];
    expect(event).toMatchObject({
      action: "admin.location.session_country_changed",
      country: "US",
    });
    expect(typeof event?.ipHash).toBe("string");
    expect(hashLocationIp("203.0.113.12")).toMatch(/^[a-f0-9]{64}$/);
    expect(mocks.sendMail).toHaveBeenCalledOnce();
  });
});
