import "server-only";

export async function verifyTurnstileToken(
  token: string,
  remoteIp: string | null,
  secret = process.env.TURNSTILE_SECRET_KEY,
): Promise<boolean> {
  if (!secret) return process.env.NODE_ENV !== "production";

  try {
    const payload = new URLSearchParams({ secret, response: token });
    if (remoteIp) payload.set("remoteip", remoteIp);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: payload,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const result: unknown = await response.json();
    return (
      typeof result === "object" &&
      result !== null &&
      "success" in result &&
      result.success === true
    );
  } catch {
    return false;
  }
}
