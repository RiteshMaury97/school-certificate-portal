import { describe, expect, it } from "vitest";

import {
  assertVerifiedGoogleSignIn,
  isGoogleSignIn,
  unverifiedSignInProvider,
} from "../src/server/signin-provider";

function jwt(claims: unknown): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256" })}.${encode(claims)}.signature`;
}

describe("sign-in provider helpers", () => {
  it("reads the provider hint from a JWT payload", () => {
    expect(unverifiedSignInProvider(jwt({ firebase: { sign_in_provider: "google.com" } }))).toBe(
      "google.com",
    );
    expect(unverifiedSignInProvider(jwt({ firebase: { sign_in_provider: "password" } }))).toBe(
      "password",
    );
  });

  it("returns null for missing, malformed or provider-less tokens", () => {
    expect(unverifiedSignInProvider(undefined)).toBeNull();
    expect(unverifiedSignInProvider("")).toBeNull();
    expect(unverifiedSignInProvider("not-a-jwt")).toBeNull();
    expect(unverifiedSignInProvider("a.%%%.c")).toBeNull();
    expect(unverifiedSignInProvider(jwt({ firebase: {} }))).toBeNull();
    expect(unverifiedSignInProvider(jwt({ firebase: { sign_in_provider: 5 } }))).toBeNull();
  });

  it("accepts only verified Google tokens", () => {
    expect(isGoogleSignIn({ firebase: { sign_in_provider: "google.com" } })).toBe(true);
    expect(isGoogleSignIn({ firebase: { sign_in_provider: "password" } })).toBe(false);
    expect(isGoogleSignIn({})).toBe(false);
    expect(() => assertVerifiedGoogleSignIn({ firebase: { sign_in_provider: "google.com" } })).not.toThrow();
  });

  it("rejects a forged Google hint whose verified token is not Google", () => {
    expect(() => assertVerifiedGoogleSignIn({ firebase: { sign_in_provider: "password" } })).toThrow("APP_CHECK");
    expect(() => assertVerifiedGoogleSignIn({})).toThrow("APP_CHECK");
  });
});
