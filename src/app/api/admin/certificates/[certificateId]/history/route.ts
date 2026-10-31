import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { apiError, requireRoles } from "@/server/security";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    await requireRoles(request, ["approver"]);
    const { certificateId } = await context.params;
    const snap = await db
      .collection("auditLogs")
      .where("targetId", "==", certificateId)
      .limit(100)
      .get();
    const events = snap.docs
      .map((doc) => ({
        id: doc.id,
        action: doc.get("action"),
        actorUid: doc.get("actorUid"),
        timestamp: doc.get("timestamp")?.toDate?.().toISOString?.() ?? null,
      }))
      .sort((a, b) =>
        String(a.timestamp ?? "").localeCompare(String(b.timestamp ?? "")),
      );
    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
