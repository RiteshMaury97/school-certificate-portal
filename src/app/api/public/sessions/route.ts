import { NextResponse } from "next/server";
import { db, describeFirebaseError } from "@/server/firebase-admin";
import { ensurePublicSessions } from "@/server/public-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    // Builds the compact index on first use so a fresh database never shows an error.
    await ensurePublicSessions();
    const snapshot = await db.collection("publicSessions").doc("main").get();
    const stored: unknown = snapshot.get("sessions");
    const sessions = Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === "string" && /^\d{4}-\d{2}$/.test(value))
      : [];
    return NextResponse.json({ sessions }, { headers: NO_STORE });
  } catch (error) {
    // Logged server-side (no secrets) so a misconfiguration is diagnosable instead of silent.
    console.error("[api/public/sessions]", describeFirebaseError(error));
    return NextResponse.json(
      { error: "Sessions are temporarily unavailable." },
      { status: 503, headers: NO_STORE },
    );
  }
}
