import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Legacy endpoint intentionally disabled. Use the short-lived student access token route.
export function GET() {
  return NextResponse.json(
    { error: "Certificate unavailable." },
    { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }
  );
}
