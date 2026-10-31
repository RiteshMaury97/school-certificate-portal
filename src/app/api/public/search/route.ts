import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Legacy endpoint intentionally disabled. Use POST /api/certificates/search.
export async function POST() {
  return NextResponse.json(
    { error: "Certificate search endpoint has moved." },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
