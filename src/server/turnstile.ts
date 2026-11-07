import "server-only";

export type TurnstileVerification =
  | { ok: true }
  | { ok: false; reason: "not-configured" | "unavailable" | "rejected"; errorCodes: string[] };

function cloudflareErrorCodes(result: unknown): string[] {
  if (typeof result !== "object" || result === null || !("error-codes" in result)) return [];
  const codes = result["error-codes"];
  return Array.isArray(codes)
    ? codes.filter((code): code is string => typeof code === "string").slice(0, 8)
    : [];
}

/**
 * Verifies a Turnstile token against exactly the secret it is given. A missing secret never
 * falls back to another widget's secret: outside production verification is skipped, in
 * production it fails closed and reports "not-configured" so the cause is visible in logs.
 */
export async function checkTurnstileToken(
  token: string,
  remoteIp: string | null,
  secret: string | undefined,
): Promise<TurnstileVerification> {
  const normalizedSecret = secret?.trim();
  if (!normalizedSecret) {
    return process.env.NODE_ENV !== "production"
      ? { ok: true }
      : { ok: false, reason: "not-configured", errorCodes: [] };
  }

  try {
    const payload = new URLSearchParams({ secret: normalizedSecret, response: token });
    if (remoteIp) payload.set("remoteip", remoteIp);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: payload,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ok: false, reason: "unavailable", errorCodes: [] };
    const result: unknown = await response.json();
    if (
      typeof result === "object" &&
      result !== null &&
      "success" in result &&
      result.success === true
    )
      return { ok: true };
    return { ok: false, reason: "rejected", errorCodes: cloudflareErrorCodes(result) };
  } catch {
    return { ok: false, reason: "unavailable", errorCodes: [] };
  }
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp: string | null,
  secret = process.env.TURNSTILE_SECRET_KEY,
): Promise<boolean> {
  return (await checkTurnstileToken(token, remoteIp, secret)).ok;
}
