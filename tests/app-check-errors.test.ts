import { describe, expect, it } from "vitest";

import {
  APP_CHECK_FAILURE_MESSAGE,
  appCheckFailureCode,
  appCheckFailureMessage,
} from "../src/lib/app-check-errors";

const appCheckCodes = [
  "appCheck/initial-throttle",
  "appCheck/throttled",
  "appCheck/fetch-status-error",
];

describe("App Check failure messages", () => {
  it.each(appCheckCodes)("maps %s to the fixed safe message", (code) => {
    const raw = Object.assign(new Error("Raw message containing a hostname and key"), { code });

    expect(appCheckFailureCode(raw)).toBe(code);
    expect(appCheckFailureMessage(raw)).toBe(APP_CHECK_FAILURE_MESSAGE);
    expect(appCheckFailureMessage(raw)).not.toContain("hostname");
    expect(appCheckFailureMessage(raw)).not.toContain("key");
  });

  it("maps Turnstile provider failures to the fixed safe message", () => {
    const cause = Object.assign(new Error("Raw Turnstile hostname and key details"), {
      code: "appCheck/turnstile-error",
    });

    expect(appCheckFailureCode(cause)).toBe("appCheck/turnstile-error");
    expect(appCheckFailureMessage(cause)).toBe(APP_CHECK_FAILURE_MESSAGE);
    expect(appCheckFailureMessage(cause)).not.toContain("hostname");
    expect(appCheckFailureMessage(cause)).not.toContain("key");
  });
});
