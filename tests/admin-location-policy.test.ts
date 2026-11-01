import { afterEach, describe, expect, it, vi } from "vitest";

import { requesterCountry } from "../src/server/request-origin";
import {
  didSessionCountryChange,
  isAdminLocationAllowed,
  isBreakGlassActive,
  ipMatchesCidr,
  type AdminLocationPolicy,
} from "../src/shared/admin-location-policy";

const blockedPolicy: AdminLocationPolicy = {
  allowedAdminCountries: ["IN"],
  adminIpAllowlist: ["203.0.113.0/24", "2001:db8::/32"],
  adminEnforcementMode: "block",
};

afterEach(() => vi.unstubAllEnvs());

describe("admin location policy", () => {
  it("allows configured countries and blocks countries outside the policy", () => {
    expect(isAdminLocationAllowed(blockedPolicy, "IN", "198.51.100.4", false)).toBe(true);
    expect(isAdminLocationAllowed(blockedPolicy, "US", "198.51.100.4", false)).toBe(false);
  });

  it("allows matching IPv4 and IPv6 school CIDRs", () => {
    expect(ipMatchesCidr("203.0.113.52", "203.0.113.0/24")).toBe(true);
    expect(ipMatchesCidr("203.0.114.52", "203.0.113.0/24")).toBe(false);
    expect(ipMatchesCidr("2001:db8:1::5", "2001:db8::/32")).toBe(true);
    expect(isAdminLocationAllowed(blockedPolicy, "US", "203.0.113.52", false)).toBe(true);
  });

  it("allows active exceptions and rejects expired break-glass exceptions", () => {
    const now = Date.now();
    expect(isBreakGlassActive(now + 1, now)).toBe(true);
    expect(isBreakGlassActive(now, now)).toBe(false);
    expect(isBreakGlassActive(new Date(now - 1000), now)).toBe(false);
    expect(
      isAdminLocationAllowed(blockedPolicy, "US", "198.51.100.4", isBreakGlassActive(now + 1, now)),
    ).toBe(true);
    expect(
      isAdminLocationAllowed(blockedPolicy, "US", "198.51.100.4", isBreakGlassActive(now - 1, now)),
    ).toBe(false);
  });

  it("detects a session country change and treats header spoofing through the trusted origin helper", () => {
    expect(didSessionCountryChange("IN", "US")).toBe(true);
    expect(didSessionCountryChange("in", "IN")).toBe(false);
    expect(didSessionCountryChange("IN", "")).toBe(false);
    vi.stubEnv("TRUST_CLOUDFLARE_PROXY", "false");
    const request = new Request("https://school.example/admin", {
      headers: { "cf-ipcountry": "IN" },
    });
    expect(requesterCountry(request)).toBe("");
  });
});
