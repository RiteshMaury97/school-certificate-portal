import { describe, expect, it } from "vitest";

import { isAllowedRequestOrigin } from "../src/shared/origin-policy";

describe("request origin policy", () => {
  const configuredOrigin = "http://localhost:3000";

  it("accepts the configured origin in development and production", () => {
    expect(
      isAllowedRequestOrigin(configuredOrigin, configuredOrigin, true),
    ).toBe(true);
    expect(
      isAllowedRequestOrigin(configuredOrigin, configuredOrigin, false),
    ).toBe(true);
  });

  it("accepts localhost and IPv4 loopback on arbitrary ports only in development", () => {
    expect(
      isAllowedRequestOrigin("http://localhost:3001", configuredOrigin, true),
    ).toBe(true);
    expect(
      isAllowedRequestOrigin("http://127.0.0.1:5173", configuredOrigin, true),
    ).toBe(true);
    expect(
      isAllowedRequestOrigin("http://localhost:3001", configuredOrigin, false),
    ).toBe(false);
  });

  it("rejects remote, HTTPS-mismatched, malformed, and missing origins", () => {
    expect(
      isAllowedRequestOrigin("https://localhost:3000", configuredOrigin, true),
    ).toBe(false);
    expect(
      isAllowedRequestOrigin("http://evil.example:3000", configuredOrigin, true),
    ).toBe(false);
    expect(isAllowedRequestOrigin("not an origin", configuredOrigin, true)).toBe(
      false,
    );
    expect(isAllowedRequestOrigin(null, configuredOrigin, true)).toBe(false);
  });
});
