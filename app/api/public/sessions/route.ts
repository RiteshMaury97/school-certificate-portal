import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebase-admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const snapshot = await db.collection("publicSessions").doc("main").get();
    const sessions =
      snapshot.exists && Array.isArray(snapshot.get("sessions"))
        ? (snapshot.get("sessions") as unknown[]).filter(
            (value): value is string =>
              typeof value === "string" && /^\d{4}-\d{2}$/.test(value),
          )
        : [];
    return NextResponse.json(
      { sessions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Sessions are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
