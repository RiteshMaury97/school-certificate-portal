/** Maps Firebase Auth error codes to messages that tell the administrator what to do. */
const CREDENTIAL_CODES = [
  "auth/invalid-credential",
  "auth/wrong-password",
  "auth/user-not-found",
  "auth/invalid-email",
];

export function errorCode(cause: unknown): string {
  return (cause as { code?: string } | null)?.code ?? "";
}
export function isBadCredentials(cause: unknown): boolean {
  return CREDENTIAL_CODES.includes(errorCode(cause));
}
export function isMfaRequired(cause: unknown): boolean {
  return errorCode(cause) === "auth/multi-factor-auth-required";
}

export function describeSignInError(cause: unknown): string {
  const code = errorCode(cause);
  if (isBadCredentials(cause))
    return "The email or password is incorrect. Check your details or reset your password.";
  switch (code) {
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes, or reset your password, then try again.";
    case "auth/network-request-failed":
      return "Network problem. Check your connection and try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Contact the school superadministrator.";
    case "auth/unauthorized-domain":
      return "This website address is not authorised for sign-in in Firebase (Authentication → Settings → Authorized domains).";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled in Firebase Authentication.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
    default:
      if (cause instanceof Error && cause.message) return cause.message;
      return "Unable to sign in. Check your details or contact the school administrator.";
  }
}

export function describeEnrollError(cause: unknown): string {
  switch (errorCode(cause)) {
    case "auth/invalid-verification-code":
      return "That code is not correct. Check the code in your authenticator app and try again.";
    case "auth/unverified-email":
      return "Verify your email address first, then set up the authenticator.";
    case "auth/requires-recent-login":
      return "For security, sign in again and then set up the authenticator.";
    case "auth/network-request-failed":
      return "Network problem. Check your connection and try again.";
    default:
      return "Could not set up the authenticator. Check your phone’s clock is automatic and try again.";
  }
}

/** Only follow same-site admin paths after sign-in (prevents open redirects). */
export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/admin") || value.startsWith("//")) return "/admin";
  if (value === "/admin/login" || value === "/admin/mfa") return "/admin";
  return value;
}
