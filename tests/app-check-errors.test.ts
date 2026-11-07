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

  it.each(["appCheck/recaptcha-error", "auth/captcha-check-failed", "recaptcha/error"])(
    "maps reCAPTCHA error %s to the fixed safe message",
    (code) => {
      const raw = Object.assign(new Error("Raw reCAPTCHA host and key details"), { code });

      expect(appCheckFailureCode(raw)).toBe("appCheck/recaptcha-error");
      expect(appCheckFailureMessage(raw)).toBe(APP_CHECK_FAILURE_MESSAGE);
      expect(appCheckFailureMessage(raw)).not.toContain("host");
      expect(appCheckFailureMessage(raw)).not.toContain("key");
    },
  );
});
