export const ADMIN_GOOGLE_SIGN_IN_EVENT = "sis:admin-google-sign-in";

export function beginGoogleSignIn(): Promise<void> {
  window.dispatchEvent(new Event(ADMIN_GOOGLE_SIGN_IN_EVENT));
  return Promise.resolve();
}
