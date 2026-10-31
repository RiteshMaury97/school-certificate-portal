import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serverTimestamp: vi.fn(() => new Date("2026-01-01T00:00:00.000Z")),
  sent: vi.fn(async (_message: unknown) => undefined),
}));
vi.mock("server-only", () => ({}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: mocks.serverTimestamp },
}));
vi.mock("@/server/firebase-admin", () => ({ db: {} }));
vi.mock("@/server/mailer", () => ({ sendAdminOtpEmail: mocks.sent }));

import {
  canSendAdminOtp,
  adminOtpRecipient,
  isAdminOtpLockThresholdReached,
  consumeVerifiedAdminOtpChallenge,
  createAdminOtpChallengeRecord,
  hashAdminOtp,
  verifyAdminOtpChallenge,
} from "../src/server/admin-otp";

type Challenge = Record<string, unknown>;
function fakeStore(initial: Challenge) {
  const state = { ...initial };
  const ref = {} as never;
  const transaction = {
    get: vi.fn(async () => ({
      exists: true,
      get: (key: string) => state[key],
    })),
    update: vi.fn((_ref: unknown, patch: Challenge) => Object.assign(state, patch)),
  };
  return { state, ref, transaction: transaction as never };
}

const now = Date.now();
const challengeId = "2f54c7b0-06ea-44d1-a9d2-35d66c4a99ad";
const uid = "admin-uid-1";
const code = "004281";

beforeEach(() => {
  process.env.OTP_HMAC_SECRET = "test-secret-that-is-at-least-thirty-two-bytes";
  vi.clearAllMocks();
});

describe("custom administrator email-code flow", () => {
  it("accepts the correct code and stores only its HMAC digest", async () => {
    const record = createAdminOtpChallengeRecord({ uid, challengeId, code, now, ipHash: "ip", deviceHash: "device" });
    expect(record).not.toHaveProperty("code");
    expect(record.codeHash).toBe(hashAdminOtp(challengeId, uid, code));
    expect(record.codeHash).not.toBe(code);
    const fake = fakeStore({ ...record, expiresAt: new Date(now + 600_000) });
    const result = await verifyAdminOtpChallenge(fake.transaction, fake.ref, { uid, challengeId, code, now });
    expect(result).toEqual({ valid: true, attemptsRemaining: 4, exhausted: false });
    expect(fake.state.attempts).toBe(1);
    expect(fake.state.verifiedAt).toBeInstanceOf(Date);
  });

  it("increments attempts for a wrong code and refuses the sixth attempt after exhaustion", async () => {
    const record = createAdminOtpChallengeRecord({ uid, challengeId, code, now, ipHash: "ip", deviceHash: "device" });
    const fake = fakeStore({ ...record, expiresAt: new Date(now + 600_000) });
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const result = await verifyAdminOtpChallenge(fake.transaction, fake.ref, { uid, challengeId, code: "999999", now });
      expect(result.valid).toBe(false);
      expect(result.attemptsRemaining).toBe(5 - attempt);
    }
    expect(fake.state.attempts).toBe(5);
    expect(fake.state.consumedAt).toBeInstanceOf(Date);
    expect(isAdminOtpLockThresholdReached(5)).toBe(true);
    const sixth = await verifyAdminOtpChallenge(fake.transaction, fake.ref, { uid, challengeId, code, now });
    expect(sixth.valid).toBe(false);
  });

  it("rejects expired, consumed and another-user challenges", async () => {
    const record = createAdminOtpChallengeRecord({ uid, challengeId, code, now, ipHash: "ip", deviceHash: "device" });
    const expired = fakeStore({ ...record, expiresAt: new Date(now - 1) });
    expect((await verifyAdminOtpChallenge(expired.transaction, expired.ref, { uid, challengeId, code, now })).valid).toBe(false);
    const consumed = fakeStore({ ...record, expiresAt: new Date(now + 600_000), consumedAt: new Date(now) });
    expect((await verifyAdminOtpChallenge(consumed.transaction, consumed.ref, { uid, challengeId, code, now })).valid).toBe(false);
    const foreign = fakeStore({ ...record, uid: "different-uid", expiresAt: new Date(now + 600_000) });
    expect((await verifyAdminOtpChallenge(foreign.transaction, foreign.ref, { uid, challengeId, code, now })).valid).toBe(false);
  });

  it("enforces resend cooldown and hourly account/IP caps", () => {
    expect(canSendAdminOtp({ lastSentAt: now - 30_000, accountHourlyCount: 0, ipHourlyCount: 0, now })).toBe(false);
    expect(canSendAdminOtp({ lastSentAt: now - 60_000, accountHourlyCount: 5, ipHourlyCount: 0, now })).toBe(false);
    expect(canSendAdminOtp({ lastSentAt: now - 60_000, accountHourlyCount: 0, ipHourlyCount: 30, now })).toBe(false);
    expect(canSendAdminOtp({ lastSentAt: now - 60_000, accountHourlyCount: 4, ipHourlyCount: 29, now })).toBe(true);
  });

  it("requires a verified, unexpired, unconsumed challenge for session and re-auth grants", async () => {
    const record = createAdminOtpChallengeRecord({ uid, challengeId, code, now, ipHash: "ip", deviceHash: "device" });
    const unverified = fakeStore({ ...record, expiresAt: new Date(now + 600_000) });
    expect(await consumeVerifiedAdminOtpChallenge(unverified.transaction, unverified.ref, uid, now)).toBe(false);
    const verified = fakeStore({ ...record, expiresAt: new Date(now + 600_000), verifiedAt: new Date(now - 1_000) });
    expect(await consumeVerifiedAdminOtpChallenge(verified.transaction, verified.ref, uid, now)).toBe(true);
    expect(verified.state.consumedAt).toBeInstanceOf(Date);
    const alreadyUsed = await consumeVerifiedAdminOtpChallenge(verified.transaction, verified.ref, uid, now);
    expect(alreadyUsed).toBe(false);
  });

  it("rejects a verified challenge older than the five-minute re-auth window", async () => {
    const record = createAdminOtpChallengeRecord({ uid, challengeId, code, now, ipHash: "ip", deviceHash: "device" });
    const stale = fakeStore({ ...record, expiresAt: new Date(now + 600_000), verifiedAt: new Date(now - 300_001) });
    expect(await consumeVerifiedAdminOtpChallenge(stale.transaction, stale.ref, uid, now)).toBe(false);
  });

  it("uses the stored administrator email as the delivery destination", async () => {
    const adminsDocument = { email: " Stored-Admin@School.Example " };
    const mailRequest = { to: adminOtpRecipient(adminsDocument), code, schoolName: "School" };
    await mocks.sent(mailRequest);
    expect(mocks.sent).toHaveBeenCalledWith(expect.objectContaining({ to: "stored-admin@school.example" }));
  });
});
