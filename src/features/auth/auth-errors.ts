/** Authentication stages used for actionable provider guidance. */
export type SignInStage = "password" | "google" | "email-code";
const CREDENTIAL_CODES = [
  "auth/invalid-credential",
  "auth/invalid-login-credentials",
  "auth/wrong-password",
  "auth/user-not-found",
  "auth/invalid-email",
];
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
  if (code === "auth/too-many-requests")
    return "Too many attempts. Wait a few minutes and try again.";
  if (code === "auth/network-request-failed")
    return "Network problem. Check your connection and try again.";
  if (code === "auth/user-disabled")
    return "This account has been disabled. Contact the school administrator.";
  if (code === "auth/unauthorized-domain")
    return "This website is not authorised in Firebase Authentication settings.";
  if (code === "auth/popup-blocked")
    return "Your browser blocked the sign-in window. Allow pop-ups and try again.";
  return cause instanceof Error && cause.message
    ? cause.message
    : "Unable to sign in. Check your details or contact the school administrator.";
}
export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/admin") || value.startsWith("//")) return "/admin";
  if (value === "/admin/login" || value === "/admin/email-code") return "/admin";
  return value;
}
