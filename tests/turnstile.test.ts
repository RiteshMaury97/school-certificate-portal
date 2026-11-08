import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { checkTurnstileToken, verifyTurnstileToken } from "../src/server/turnstile";

function siteverify(body: unknown, ok = true) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(body), { status: ok ? 200 : 500 }),
  );
}

function requestBody(fetchMock: ReturnType<typeof siteverify>): URLSearchParams {
  const body = fetchMock.mock.calls[0]?.[1]?.body;
  if (!(body instanceof URLSearchParams)) throw new Error("Expected a URL encoded request body");
  return body;
}

describe("checkTurnstileToken", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "login-widget-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fails closed in production when the secret is missing and never uses another secret", async () => {
    const fetchMock = siteverify({ success: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkTurnstileToken("token", null, "");

    expect(result).toEqual({ ok: false, reason: "not-configured", errorCodes: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends exactly the supplied secret to Cloudflare", async () => {
    const fetchMock = siteverify({ success: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkTurnstileToken("token", "203.0.113.5", "app-check-secret")).resolves.toEqual({
      ok: true,
    });

    const body = requestBody(fetchMock);
    expect(body.get("secret")).toBe("app-check-secret");
    expect(body.get("remoteip")).toBe("203.0.113.5");
  });

  it("reports Cloudflare error codes when a token is rejected", async () => {
    vi.stubGlobal("fetch", siteverify({ success: false, "error-codes": ["invalid-input-secret"] }));

    await expect(checkTurnstileToken("token", null, "wrong")).resolves.toEqual({
      ok: false,
      reason: "rejected",
      errorCodes: ["invalid-input-secret"],
    });
  });

  it("reports unavailable when Cloudflare cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    await expect(checkTurnstileToken("token", null, "secret")).resolves.toEqual({
      ok: false,
      reason: "unavailable",
      errorCodes: [],
    });
  });

  it("keeps verifyTurnstileToken defaulting to the login widget secret", async () => {
    const fetchMock = siteverify({ success: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyTurnstileToken("token", null)).resolves.toBe(true);

    expect(requestBody(fetchMock).get("secret")).toBe("login-widget-secret");
  });
});
