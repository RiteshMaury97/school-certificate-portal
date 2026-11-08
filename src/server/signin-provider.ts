export const GOOGLE_SIGN_IN_PROVIDER = "google.com";

/**
 * Reads firebase.sign_in_provider from a JWT WITHOUT verifying its signature. The result is only
 * a routing hint for deciding whether App Check (Turnstile) is needed; every caller must verify
 * the same token afterwards and call assertVerifiedGoogleSignIn, so a forged hint is rejected.
 */
export function unverifiedSignInProvider(token: string | null | undefined): string | null {
  try {
    const payload = token?.split(".")[1];
    if (!payload) return null;
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims !== "object" || claims === null) return null;
    const firebase: unknown = Reflect.get(claims, "firebase");
    if (typeof firebase !== "object" || firebase === null) return null;
    const provider: unknown = Reflect.get(firebase, "sign_in_provider");
    return typeof provider === "string" ? provider : null;
  } catch {
    return null;
  }
}

/** True when an already-verified Firebase token (ID token or session cookie) is a Google sign-in. */
export function isGoogleSignIn(decoded: object): boolean {
  const firebase: unknown = Reflect.get(decoded, "firebase");
  const provider: unknown =
    typeof firebase === "object" && firebase !== null
      ? Reflect.get(firebase, "sign_in_provider")
      : undefined;
  return provider === GOOGLE_SIGN_IN_PROVIDER;
}

/** After verifyIdToken/verifySessionCookie: the token must really be a Google sign-in. */
export function assertVerifiedGoogleSignIn(decoded: object): void {
  if (!isGoogleSignIn(decoded)) throw new Error("APP_CHECK");
}
