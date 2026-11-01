import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";

const message =
  "Public certificate services are temporarily unavailable for emergency maintenance. Please try again later.";

export async function publicEmergencyMaintenanceResponse(): Promise<NextResponse | null> {
  const settings = await db.collection("siteSettings").doc("main").get();
  if (settings.get("emergencyLockdown") !== true) return null;
  return NextResponse.json(
    { error: "maintenance", code: "SERVICE_MAINTENANCE", message },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "300",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
