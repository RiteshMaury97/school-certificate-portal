export const APP_CHECK_FAILURE_MESSAGE =
  "Security verification could not be completed. Please reload the page and try again. If this continues, contact the site administrator.";
export const APP_CHECK_MAINTENANCE_MESSAGE = "Sign-in is temporarily unavailable for maintenance.";

const APP_CHECK_ERROR_CODES = new Set([
  "appCheck/initial-throttle",
  "appCheck/throttled",
  "appCheck/fetch-status-error",
  "appCheck/turnstile-error",
  "appCheck/token-unavailable",
  "appCheck/unknown-error",
  "appCheck/maintenance",
]);

export class AppCheckTokenError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(
      code === "appCheck/maintenance" ? APP_CHECK_MAINTENANCE_MESSAGE : APP_CHECK_FAILURE_MESSAGE,
    );
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
  if (/turnstile/i.test(code)) return "appCheck/turnstile-error";
  if (cause instanceof Error && /turnstile/i.test(cause.name)) return "appCheck/turnstile-error";
  return null;
}

export function appCheckFailureMessage(cause: unknown): string | null {
  const code = appCheckFailureCode(cause);
  if (!code) return null;
  return code === "appCheck/maintenance"
    ? APP_CHECK_MAINTENANCE_MESSAGE
    : APP_CHECK_FAILURE_MESSAGE;
}

export function reportAppCheckFailure(cause: unknown): void {
  const code = appCheckFailureCode(cause);
  if (code) console.error(code);
}
