import { describe, expect, it } from "vitest";

import {
  ADMIN_HARD_SESSION_LIMIT_MS,
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_IDLE_WARNING_MS,
  isAdminSessionExpired,
} from "@/shared/session-policy";
describe("administrator session policy", () => {
  it("warns before idle timeout", () => {
    expect(ADMIN_IDLE_WARNING_MS).toBe(13 * 60_000);
    expect(ADMIN_IDLE_TIMEOUT_MS).toBe(15 * 60_000);
  });
  it("enforces an eight-hour hard limit", () => {
    expect(ADMIN_HARD_SESSION_LIMIT_MS).toBe(8 * 60 * 60_000);
  });
  it("expires after inactivity or hard expiry", () => {
    const now = 1_000_000;
    expect(isAdminSessionExpired(now - ADMIN_IDLE_TIMEOUT_MS, now + 1000, now)).toBe(true);
    expect(isAdminSessionExpired(now - 1000, now, now)).toBe(true);
    expect(isAdminSessionExpired(now - 1000, now + 1000, now)).toBe(false);
  });
});
