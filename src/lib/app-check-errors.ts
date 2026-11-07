export const APP_CHECK_FAILURE_MESSAGE =
  "Security verification could not be completed. Please reload the page and try again. If this continues, contact the site administrator.";

const APP_CHECK_ERROR_CODES = new Set([
  "appCheck/initial-throttle",
  "appCheck/throttled",
  "appCheck/fetch-status-error",
  "appCheck/recaptcha-error",
  "appCheck/token-unavailable",
  "appCheck/unknown-error",
]);

export class AppCheckTokenError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(APP_CHECK_FAILURE_MESSAGE);
    this.name = "AppCheckTokenError";
    this.code = APP_CHECK_ERROR_CODES.has(code) ? code : "appCheck/unknown-error";
  }
}

function errorCode(cause: unknown): string {
  if (typeof cause !== "object" || cause === null || !("code" in cause)) return "";
  return typeof cause.code === "string" ? cause.code : "";
}

export function appCheckFailureCode(cause: unknown): string | null {
  if (cause instanceof AppCheckTokenError) return cause.code;

  const code = errorCode(cause);
  if (APP_CHECK_ERROR_CODES.has(code)) return code;
  if (code.startsWith("appCheck/")) return "appCheck/unknown-error";
  if (/recaptcha|captcha/i.test(code)) return "appCheck/recaptcha-error";
  if (cause instanceof Error && /recaptcha|captcha/i.test(cause.name))
    return "appCheck/recaptcha-error";
  return null;
}

export function appCheckFailureMessage(cause: unknown): string | null {
  return appCheckFailureCode(cause) ? APP_CHECK_FAILURE_MESSAGE : null;
}

export function reportAppCheckFailure(cause: unknown): void {
  const code = appCheckFailureCode(cause);
  if (code) console.error(code);
}
