import { NextResponse } from "next/server";

import { db, describeFirebaseError } from "@/server/firebase-admin";
import { ensurePublicSessions } from "@/server/public-sessions";
import { normalizeAcademicSession } from "@/shared/academic-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    // Builds the compact index on first use so a fresh database never shows an error.
    await ensurePublicSessions();
    const [snapshot, catalog] = await Promise.all([
      db.collection("publicSessions").doc("main").get(),
      db.collection("sessions").limit(200).get(),
    ]);
    const stored: unknown = snapshot.get("sessions");
    const sessions = new Set<string>();
    if (Array.isArray(stored)) {
      for (const value of stored) {
        if (typeof value === "string") {
          const normalized = normalizeAcademicSession(value);
          if (normalized) sessions.add(normalized);
        }
      }
    }
    for (const doc of catalog.docs) {
      if (doc.get("isActive") === false) continue;
      for (const value of [doc.get("label"), doc.get("name"), doc.id]) {
        if (typeof value !== "string") continue;
        const normalized = normalizeAcademicSession(value);
        if (normalized) {
          sessions.add(normalized);
          break;
        }
      }
    }
    return NextResponse.json(
      { sessions: [...sessions].sort((a, b) => b.localeCompare(a)) },
      { headers: NO_STORE },
    );
  } catch (error) {
    // Logged server-side (no secrets) so a misconfiguration is diagnosable instead of silent.
    console.error("[api/public/sessions]", describeFirebaseError(error));
    return NextResponse.json(
      { error: "Sessions are temporarily unavailable." },
      { status: 503, headers: NO_STORE },
    );
  }
}
