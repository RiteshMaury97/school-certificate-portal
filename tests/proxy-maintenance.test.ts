import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const origin = "https://tc.sischool.in";

function mockMaintenance(enabled: boolean) {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SITE_URL", origin);
  vi.stubEnv("APP_ORIGIN", "");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ settings: { maintenanceMode: enabled } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

async function freshProxy() {
  vi.resetModules();
  return (await import("../src/proxy")).proxy;
}

function request(path: string, method = "GET") {
  return new NextRequest(`${origin}${path}`, {
    method,
    headers: { Origin: origin },
  });
}

describe("maintenance proxy policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps App Check available but blocks public APIs during maintenance", async () => {
    mockMaintenance(true);
    const proxy = await freshProxy();

    const publicResponse = await proxy(request("/api/certificates/search"));
    expect(publicResponse.status).toBe(503);
    expect(await publicResponse.json()).toMatchObject({ stage: "maintenance" });
    expect((await proxy(request("/faq"))).status).toBe(503);

    const appCheckResponse = await proxy(request("/api/app-check/token", "POST"));
    expect(appCheckResponse.status).toBe(200);
    expect(appCheckResponse.headers.get("x-middleware-next")).toBe("1");
  });

  it("allows public APIs and the App Check route when maintenance is off", async () => {
    mockMaintenance(false);
    const proxy = await freshProxy();

    expect((await proxy(request("/api/certificates/search"))).status).toBe(200);
    expect((await proxy(request("/api/app-check/token", "POST"))).status).toBe(200);
  });
});
