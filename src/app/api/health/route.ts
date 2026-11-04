import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requiredEnvironment: Record<string, () => boolean> = {
  firebaseClient: () =>
    Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() &&
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
    ),
  firebaseAdmin: () =>
    Boolean(
      process.env.FIREBASE_PROJECT_ID?.trim() &&
      (Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?.trim()) ||
        Boolean(
          process.env.FIREBASE_CLIENT_EMAIL?.trim() && process.env.FIREBASE_PRIVATE_KEY?.trim(),
        )),
    ),
  r2: () =>
    Boolean(
      process.env.R2_ACCOUNT_ID?.trim() &&
      process.env.R2_ACCESS_KEY_ID?.trim() &&
      process.env.R2_SECRET_ACCESS_KEY?.trim() &&
      process.env.R2_BUCKET?.trim(),
    ),
  clamd: () =>
    Boolean(process.env.CLAMD_HOST?.trim() && process.env.MALWARE_SCAN_MODE?.trim() === "required"),
};

export function GET() {
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  return NextResponse.json(
    {
      version: "1.0.0",
      environment: env,
      requiredEnvironment: Object.fromEntries(
        Object.entries(requiredEnvironment).map(([name, isPresent]) => [name, isPresent()]),
      ),
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
  );
}
