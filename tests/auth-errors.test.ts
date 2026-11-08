import { describe, expect, it } from "vitest";

import { describeSignInError } from "../src/features/auth/auth-errors";

describe("Google sign-in error messages", () => {
  it.each([
    [
      "auth/unauthorized-domain",
      "This website is not enabled for Google sign-in yet. Contact the site administrator.",
    ],
    [
      "auth/popup-blocked",
      "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.",
    ],
    ["auth/popup-closed-by-user", "Google sign-in was cancelled. Try again when you are ready."],
    [
      "auth/network-request-failed",
      "Google sign-in could not reach the network. Check your connection and try again.",
    ],
  ])("maps %s to a clear message", (code, message) => {
    expect(describeSignInError({ code, message: `Firebase: ${code}` }, "google")).toBe(message);
  });
});
