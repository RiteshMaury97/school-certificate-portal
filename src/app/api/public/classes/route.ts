import { NextResponse } from "next/server";

import { db, describeFirebaseError } from "@/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await db.collection("classes").limit(200).get();
    const classes = snapshot.docs
      .filter((doc) => doc.get("isActive") !== false)
      .map((doc) => String(doc.get("label") ?? doc.get("name") ?? doc.id).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ classes }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/public/classes]", describeFirebaseError(error));
    return NextResponse.json(
      { error: "Classes are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
