/** Authentication stages used for actionable provider guidance. */
export type SignInStage = "password" | "google" | "email-code";
const CREDENTIAL_CODES = [
  "auth/invalid-credential",
  "auth/invalid-login-credentials",
  "auth/wrong-password",
  "auth/user-not-found",
  "auth/invalid-email",
];
const PROVIDER_ERROR_MESSAGES: Record<string, string> = {
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed":
    "Google sign-in could not reach the network. Check your connection and try again.",
  "auth/user-disabled": "This account has been disabled. Contact the school administrator.",
  "auth/unauthorized-domain":
    "This website is not enabled for Google sign-in yet. Contact the site administrator.",
  "auth/popup-blocked":
    "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.",
  "auth/popup-closed-by-user": "Google sign-in was cancelled. Try again when you are ready.",
  "auth/cancelled-popup-request": "Google sign-in was cancelled. Try again when you are ready.",
  "auth/account-exists-with-different-credential":
    "An account already exists with this email. Sign in using its original method or contact the school administrator.",
  "auth/credential-already-in-use":
    "This Google account is already linked to another account. Contact the school administrator.",
  "auth/weak-password": "Choose a stronger password and try again.",
  "auth/requires-recent-login": "For security, sign in again before continuing.",
  "auth/invalid-continue-uri":
    "The sign-in return address is not configured correctly. Contact the school administrator.",
  "auth/unauthorized-continue-uri":
    "The sign-in return address is not configured correctly. Contact the school administrator.",
  "auth/internal-error":
    "Google sign-in could not be completed. Try again, or use email and password.",
};
type FirebaseErrorLike = { code: string };
function hasErrorCode(cause: unknown): cause is FirebaseErrorLike {
  return (
    typeof cause === "object" && cause !== null && "code" in cause && typeof cause.code === "string"
  );
}
export function errorCode(cause: unknown): string {
  return hasErrorCode(cause) ? cause.code : "";
}
export function isBadCredentials(cause: unknown): boolean {
  return CREDENTIAL_CODES.includes(errorCode(cause));
}
export function describeSignInError(cause: unknown, stage: SignInStage): string {
  const code = errorCode(cause);
  if (code === "auth/operation-not-allowed")
    return stage === "password"
      ? "Email and password sign-in is disabled. Ask the administrator to enable Email/Password in Firebase Authentication."
      : "Google sign-in is disabled. Enable Google in Firebase Authentication.";
  if (isBadCredentials(cause))
    return "The email or password is incorrect. Check your details or reset your password.";
  if (PROVIDER_ERROR_MESSAGES[code]) return PROVIDER_ERROR_MESSAGES[code];
  return cause instanceof Error && cause.message
    ? cause.message
    : "Unable to sign in. Check your details or contact the school administrator.";
}
export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/admin") || value.startsWith("//")) return "/admin";
  if (value === "/admin/login" || value === "/admin/email-code") return "/admin";
  return value;
}
