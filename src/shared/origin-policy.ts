/**
 * Same-origin policy for state-changing requests. Development may use arbitrary
 * localhost/127.0.0.1 ports; this exception is never enabled in production.
 */
export function isAllowedRequestOrigin(
  origin: string | null,
  expectedOrigin: string,
  development: boolean,
): boolean {
  if (!origin) return false;
  if (origin === expectedOrigin) return true;
  if (!development) return false;

  try {
    const parsed = new URL(origin);
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      parsed.origin === origin
    );
  } catch {
    return false;
  }
}
