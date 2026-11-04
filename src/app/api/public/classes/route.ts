import { NextResponse } from "next/server";

import { db, describeFirebaseError } from "@/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const snapshot = await db.collection("classes").limit(200).get();
    const classes = snapshot.docs
      .filter((doc) => doc.get("isActive") !== false)
      .map((doc) => {
        const label: unknown = doc.get("label");
        const name: unknown = doc.get("name");
        return typeof label === "string" && label.trim()
          ? label.trim()
          : typeof name === "string" && name.trim()
            ? name.trim()
            : doc.id;
      })
      .filter(Boolean);

    return NextResponse.json(
      { classes: [...new Set(classes)].sort((a, b) => a.localeCompare(b)) },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[api/public/classes]", describeFirebaseError(error));
    return NextResponse.json(
      { error: "Classes are temporarily unavailable." },
      { status: 503, headers: NO_STORE },
    );
  }
}
