import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { validateServerEnvironment } from "@/server/env";
import { PRODUCTION_REQUIRED_ENV_NAMES } from "@/server/env-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicEnvironmentGroups: Record<string, readonly string[]> = {
  firebaseClient: [
    "FIREBASE_API_KEY",
    "FIREBASE_AUTH_DOMAIN",
    "FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
  ],
  firebaseAdmin: [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_SERVICE_ACCOUNT_BASE64",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
  ],
  r2: [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "BACKUP_R2_BUCKET",
  ],
  turnstile: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"],
  appCheck: ["NEXT_PUBLIC_APPCHECK_TURNSTILE_SITE_KEY", "APPCHECK_TURNSTILE_SECRET_KEY"],
  malwareScan: ["CLAMD_HOST", "MALWARE_SCAN_MODE"],
};
const WEB_APP_ID_PATTERN = /^\d+:\d+:web:[0-9a-f]+$/i;

function configured(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function publicStatus() {
  const firebaseAdminCredentials =
    configured("FIREBASE_SERVICE_ACCOUNT_BASE64") ||
    (configured("FIREBASE_CLIENT_EMAIL") && configured("FIREBASE_PRIVATE_KEY"));
  return Object.fromEntries(
    Object.entries(publicEnvironmentGroups).map(([group, names]) => {
      const valid =
        group === "firebaseAdmin"
          ? configured("FIREBASE_PROJECT_ID") && firebaseAdminCredentials
          : group === "malwareScan"
            ? configured("CLAMD_HOST") && process.env.MALWARE_SCAN_MODE === "required"
            : names.every(configured);
      return [group, valid];
    }),
  );
}

function appCheckConfiguration() {
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() ?? "";
  const firebaseAdminCredentials =
    configured("FIREBASE_SERVICE_ACCOUNT_BASE64") ||
    (configured("FIREBASE_CLIENT_EMAIL") && configured("FIREBASE_PRIVATE_KEY"));
  return {
    APPCHECK_TURNSTILE_SECRET_KEY: configured("APPCHECK_TURNSTILE_SECRET_KEY"),
    NEXT_PUBLIC_APPCHECK_TURNSTILE_SITE_KEY: configured("NEXT_PUBLIC_APPCHECK_TURNSTILE_SITE_KEY"),
    NEXT_PUBLIC_FIREBASE_APP_ID: configured("NEXT_PUBLIC_FIREBASE_APP_ID"),
    NEXT_PUBLIC_FIREBASE_APP_ID_is_web_app: WEB_APP_ID_PATTERN.test(appId),
    FIREBASE_PROJECT_ID: configured("FIREBASE_PROJECT_ID"),
    FIREBASE_ADMIN_CREDENTIALS: firebaseAdminCredentials,
  };
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !authorization.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

type Probe = { name: string; ok: boolean; error?: string };

function probeMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/\s+/g, " ").slice(0, 400);
}

async function probe(name: string, run: () => Promise<unknown>): Promise<Probe> {
  try {
    await run();
    return { name, ok: true };
  } catch (error) {
    return { name, ok: false, error: probeMessage(error) };
  }
}

/**
 * Authorized-only runtime probes. They load the same modules the failing routes load, so a
 * crash at import time (which Vercel reports as a bare 500) is reported here with its message.
 */
async function runtimeProbes(): Promise<Probe[]> {
  return [
    await probe("module: firebase-admin", () => import("@/server/firebase-admin")),
    await probe("module: security", () => import("@/server/security")),
    await probe("module: admin session route", () => import("@/app/api/admin/session/route")),
    await probe("module: public sessions route", () => import("@/app/api/public/sessions/route")),
    await probe("app check token mint", async () => {
      const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim();
      if (!appId) throw new Error("NEXT_PUBLIC_FIREBASE_APP_ID is not set");
      const { adminAppCheck, describeAppCheckMintError } = await import("@/server/firebase-admin");
      try {
        await adminAppCheck.createToken(appId, { ttlMillis: 30 * 60 * 1000 });
      } catch (error) {
        throw new Error(describeAppCheckMintError(error));
      }
    }),
    await probe("firestore read", async () => {
      const { db } = await import("@/server/firebase-admin");
      await db.collection("publicSessions").doc("main").get();
    }),
  ];
}

export async function GET(request: Request) {
  const result = validateServerEnvironment(process.env);
  const base = {
    version: "1.0.0",
    environment: result.deployment,
    requiredEnvironment: publicStatus(),
    appCheckConfiguration: appCheckConfiguration(),
  };
  const headers = {
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
  if (!authorized(request)) return NextResponse.json(base, { headers });

  return NextResponse.json(
    {
      ...base,
      valid: result.valid,
      required: result.deployment === "production" ? PRODUCTION_REQUIRED_ENV_NAMES : [],
      missing: result.missing,
      errors: result.errors,
      probes: await runtimeProbes(),
    },
    { status: result.valid ? 200 : 503, headers },
  );
}
