import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getRequestOrigin, requireRequesterIp } from "../src/server/request-origin";
import { hashRequesterIpValue } from "../src/server/security-primitives";

function request(headers: Record<string, string> = {}) {
  return { headers: new Headers(headers) };
}

describe("trusted request origin", () => {
  it("uses only the first x-vercel-forwarded-for value", () => {
    expect(
      getRequestOrigin(
        request({
          "x-vercel-forwarded-for": "203.0.113.4, 10.0.0.1",
          "x-real-ip": "198.51.100.8",
        }),
        { production: true },
      ).ip,
    ).toBe("203.0.113.4");
  });

  it("ignores x-real-ip when the Vercel forwarded header is absent", () => {
    expect(
      getRequestOrigin(request({ "x-real-ip": "198.51.100.8" }), { production: true }).ip,
    ).toBeNull();
  });

  it("ignores spoofed Cloudflare IP and country headers by default", () => {
    expect(
      getRequestOrigin(
        request({
          "cf-connecting-ip": "203.0.113.9",
          "cf-ipcountry": "ZZ",
          "cf-ipcity": "Spoofed",
        }),
        { production: true },
      ),
    ).toEqual({ ip: null, country: null, city: null });
  });

  it("fails closed without a trusted production IP and uses loopback in development", () => {
    expect(getRequestOrigin(request(), { production: true }).ip).toBeNull();
    expect(() => requireRequesterIp(request(), { production: true })).toThrow(
      "TRUSTED_CLIENT_IP_UNAVAILABLE",
    );
    expect(getRequestOrigin(request(), { production: false }).ip).toBe("127.0.0.1");
  });

  it("ignores Cloudflare supplied IP and geo headers", () => {
    expect(
      getRequestOrigin(
        request({
          "cf-connecting-ip": "203.0.113.9",
          "cf-ipcountry": "NZ",
          "cf-ipcity": "Auckland",
        }),
        { production: true },
      ),
    ).toEqual({ ip: null, country: null, city: null });
  });

  it("keeps different IPs in different rate-limit buckets", () => {
    const secret = "unit-test-secret";
    const first = hashRequesterIpValue("203.0.113.4", secret);
    const second = hashRequesterIpValue("203.0.113.5", secret);
    expect(first).not.toBe(second);
    expect(`search_ip_min_${first}_1`).not.toBe(`search_ip_min_${second}_1`);
  });
});
