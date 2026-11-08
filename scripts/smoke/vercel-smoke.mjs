#!/usr/bin/env node
import assert from "node:assert/strict";

const [rawBaseUrl, ...arguments_] = process.argv.slice(2);
if (!rawBaseUrl) {
  console.error(
    "Usage: npm run smoke -- <base-url> --environment=production|preview [--run-crons]",
  );
  process.exit(2);
}

const environmentArgument = arguments_.find((value) => value.startsWith("--environment="));
const environment = environmentArgument?.split("=", 2)[1];
if (!environment || !["production", "preview"].includes(environment)) {
  console.error("Set --environment=production or --environment=preview.");
  process.exit(2);
}
const runCrons = arguments_.includes("--run-crons");
const baseUrl = new URL(rawBaseUrl);
assert.ok(["https:", "http:"].includes(baseUrl.protocol), "Base URL must use HTTP or HTTPS.");
assert.equal(baseUrl.username, "", "Do not include credentials in the base URL.");
assert.equal(baseUrl.password, "", "Do not include credentials in the base URL.");
assert.equal(baseUrl.pathname, "/", "Pass an origin without a path.");

const cronSecret = process.env.CRON_SECRET;
if (runCrons && (!cronSecret || cronSecret.length < 32)) {
  console.error("--run-crons requires CRON_SECRET with at least 32 characters in the environment.");
  process.exit(2);
}

const checks = [];
function check(name, condition, detail = "") {
  assert.ok(condition, `${name}${detail ? `: ${detail}` : ""}`);
  checks.push(name);
  process.stdout.write(`PASS ${name}\n`);
}

async function request(path, init = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has("accept") && !path.startsWith("/api/")) headers.set("accept", "text/html");
  if (baseUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(baseUrl.hostname))
    headers.set("x-forwarded-proto", "https");
  return fetch(new URL(path, baseUrl), {
    ...init,
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(15_000),
  });
}

async function checkInlineScriptNonces(path, response) {
  const csp = response.headers.get("content-security-policy") ?? "";
  const scriptSource = csp.match(/(?:^|;)\s*script-src\s+([^;]+)/i)?.[1] ?? "";
  const nonce = scriptSource.match(/'nonce-([^']+)'/)?.[1];
  check(`${path} CSP has a script nonce`, Boolean(nonce));
  if (!nonce) return;

  const html = await response.clone().text();
  const inlineScripts = [...html.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script\s*>/gi)]
    .filter(([, attributes]) => !/\bsrc\s*=/i.test(attributes));
  const inlineStyles = [...html.matchAll(/<style\b([^>]*)>[\s\S]*?<\/style\s*>/gi)];
  check(`${path} renders nonce-bearing inline scripts`, inlineScripts.length > 0);
  const escapedNonce = nonce.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nonceAttribute = new RegExp(`\\bnonce=(['"])${escapedNonce}\\1`);
  check(
    `${path} inline scripts match their CSP nonce`,
    inlineScripts.every(([, attributes]) => nonceAttribute.test(attributes)),
  );
  check(
    `${path} inline styles match their CSP nonce`,
    inlineStyles.every(([, attributes]) => nonceAttribute.test(attributes)),
  );
  check(
    `${path} HTML is not cacheable`,
    /(?:^|,)\s*private\b/i.test(response.headers.get("cache-control") ?? "") &&
      /(?:^|,)\s*no-store\b/i.test(response.headers.get("cache-control") ?? ""),
  );
  return nonce;
}

const home = await request("/");
check("GET / returns 200", home.status === 200, `received ${home.status}`);
const login = await request("/admin/login");
check("GET /admin/login returns 200", login.status === 200, `received ${login.status}`);

const noncePaths = [
  ["/", home],
  ["/verify", await request("/verify")],
  ["/certificates", await request("/certificates")],
  ["/faq", await request("/faq")],
  ["/contact", await request("/contact")],
  ["/privacy", await request("/privacy")],
  ["/admin/login", login],
];
for (const [path, response] of noncePaths) {
  check(`GET ${path} returns 200 for nonce inspection`, response.status === 200);
  await checkInlineScriptNonces(path, response);
}
const repeatedHome = await request("/");
check("Second GET / returns 200 for nonce inspection", repeatedHome.status === 200);
const firstHomeNonce = await checkInlineScriptNonces("/ (first request)", home);
const secondHomeNonce = await checkInlineScriptNonces("/ (second request)", repeatedHome);
check("GET / generates a fresh CSP nonce per request", firstHomeNonce !== secondHomeNonce);

for (const [name, response] of [
  ["/", home],
  ["/admin/login", login],
]) {
  const csp = response.headers.get("content-security-policy");
  check(`${name} has Content-Security-Policy`, Boolean(csp));
  const scriptSource = csp?.match(/\bscript-src\s+([^;]+)/i)?.[1] ?? "";
  check(`${name} production script-src has no unsafe keywords`,
    !scriptSource.includes("'unsafe-inline'") && !scriptSource.includes("'unsafe-eval'"));
  check(`${name} CSP does not allow Vercel Live`, !scriptSource.includes("https://vercel.live"));
  check(`${name} CSP has no hand-maintained script hashes`, !scriptSource.includes("'sha256-"));
  const connectSrcDirectives = [
    ...(csp ?? "").matchAll(/\bconnect-src\s+([^;]+)/gi),
  ].map((match) => match[1]);
  check(`${name} CSP has connect-src`, connectSrcDirectives.length > 0);
  check(
    `${name} CSP connect-src allows data:`,
    connectSrcDirectives.length > 0 &&
      connectSrcDirectives.every((directive) => directive.split(/\s+/).includes("data:")),
  );
  check(
    `${name} CSP connect-src allows Cloudflare Turnstile`,
    connectSrcDirectives.length > 0 &&
      connectSrcDirectives.every((directive) =>
        directive.includes("https://challenges.cloudflare.com"),
      ),
  );
  check(`${name} has X-Frame-Options`, Boolean(response.headers.get("x-frame-options")));
  check(
    `${name} has X-Content-Type-Options: nosniff`,
    response.headers.get("x-content-type-options") === "nosniff",
  );
  if (environment === "production")
    check(`${name} has HSTS`, Boolean(response.headers.get("strict-transport-security")));
}

const health = await request("/api/health");
check("GET /api/health returns 200", health.status === 200, `received ${health.status}`);
const healthBody = await health.json();
check(
  "/api/health returns app version and environment",
  Boolean(healthBody.version && healthBody.environment),
);
const environmentPresence = healthBody.requiredEnvironment;
check(
  "/api/health exposes boolean environment presence",
  typeof environmentPresence === "object" &&
    environmentPresence !== null &&
    !Array.isArray(environmentPresence) &&
    Object.values(environmentPresence).every((value) => typeof value === "boolean"),
);

const adminRobots = login.headers.get("x-robots-tag") ?? "";
check("Admin pages are noindex", /noindex/i.test(adminRobots));
if (environment === "preview") {
  const previewRobots = home.headers.get("x-robots-tag") ?? "";
  check("Preview pages are noindex", /noindex/i.test(previewRobots));
}

const crossOrigin = await request("/api/admin/preflight", {
  method: "POST",
  headers: {
    Origin: "https://untrusted-smoke-test.invalid",
    "Content-Type": "application/json",
  },
  body: "{}",
});
check(
  "Cross-origin admin POST is rejected",
  crossOrigin.status === 403,
  `received ${crossOrigin.status}`,
);

const cronRoutes = [
  "/api/admin/backup",
  "/api/cron/security-summary",
  "/api/cron/breach-reminders",
];
for (const path of cronRoutes) {
  const unauthorized = await request(path);
  check(
    `${path} rejects missing CRON_SECRET`,
    [401, 403].includes(unauthorized.status),
    `received ${unauthorized.status}`,
  );
  if (runCrons) {
    const authorized = await request(path, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    check(
      `${path} accepts CRON_SECRET`,
      authorized.status === 200,
      `received ${authorized.status}`,
    );
  }
}

if (!runCrons)
  process.stdout.write(
    "INFO Positive cron checks skipped. Add --run-crons only on a safe staging deployment; cron handlers have real side effects.\n",
  );
process.stdout.write(`Smoke checks passed (${checks.length}).\n`);
