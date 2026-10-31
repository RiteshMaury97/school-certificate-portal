import { NextResponse } from "next/server";
import { db } from "@/server/firebase-admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const started = Date.now();
  try {
    await db.collection("_health").doc("probe").get();
    return NextResponse.json(
      {
        status: "ok",
        checks: { firestore: "ok" },
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - started,
      },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        checks: { firestore: "unavailable" },
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }
}
