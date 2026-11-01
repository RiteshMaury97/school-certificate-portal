import { afterEach, describe, expect, it, vi } from "vitest";

import {
  hashRequesterIp,
  hasTrustedRequesterIp,
  requesterCity,
  requesterCountry,
  requesterIp,
  requireRequesterIp,
  TrustedRequesterIpUnavailable,
} from "../src/server/request-origin";

const requestWith = (values: Record<string, string>) =>
  new Request("https://school.example/api", { headers: values });

afterEach(() => vi.unstubAllEnvs());

describe("trusted request origin", () => {
  it("uses the first x-vercel-forwarded-for value before x-real-ip", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      requesterIp(
        requestWith({
          "x-vercel-forwarded-for": "203.0.113.10, 10.0.0.1",
          "x-real-ip": "203.0.113.20",
        }),
      ),
    ).toBe("203.0.113.10");
    expect(requesterIp(requestWith({ "x-real-ip": "203.0.113.20" }))).toBe("203.0.113.20");
  });

  it("ignores spoofed Cloudflare IP and location headers on Vercel by default", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRUST_CLOUDFLARE_PROXY", "false");
    const request = requestWith({
      "cf-connecting-ip": "198.51.100.7",
      "cf-ipcountry": "ZZ",
      "cf-ipcity": "Spoofed City",
    });
    expect(requesterIp(request)).toBeNull();
    expect(requesterCountry(request)).toBe("");
    expect(requesterCity(request)).toBe("");
  });

  it("uses Vercel location headers and only trusts Cloudflare when explicitly configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = requestWith({
      "x-vercel-ip-country": "IN",
      "x-vercel-ip-city": "New%20Delhi",
      "cf-ipcountry": "US",
      "cf-ipcity": "Spoofed",
    });
    expect(requesterCountry(request)).toBe("IN");
    expect(requesterCity(request)).toBe("New%20Delhi");
    vi.stubEnv("TRUST_CLOUDFLARE_PROXY", "true");
    const cloudflareOnly = requestWith({
      "cf-ipcountry": "GB",
      "cf-ipcity": "London",
      "cf-connecting-ip": "203.0.113.8",
    });
    expect(requesterCountry(cloudflareOnly)).toBe("GB");
    expect(requesterCity(cloudflareOnly)).toBe("London");
    expect(requesterIp(cloudflareOnly)).toBe("203.0.113.8");
  });

  it("fails closed in production when no trusted IP is present and uses loopback in development", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRUST_CLOUDFLARE_PROXY", "false");
    const request = requestWith({});
    expect(hasTrustedRequesterIp(request)).toBe(false);
    expect(() => requireRequesterIp(request)).toThrow(TrustedRequesterIpUnavailable);
    vi.stubEnv("NODE_ENV", "development");
    expect(requesterIp(request)).toBe("127.0.0.1");
  });

  it("creates distinct rate-limit hashes for distinct client IPs", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUDIT_LOG_HMAC_SECRET", "a".repeat(32));
    expect(hashRequesterIp(requestWith({ "x-real-ip": "203.0.113.10" }))).not.toBe(
      hashRequesterIp(requestWith({ "x-real-ip": "203.0.113.11" })),
    );
  });
});
