import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { apiError, requireRoles } from "@/server/security";

import type { NextRequest} from "next/server";

function toOptionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toTimestampIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    await requireRoles(request, ["approver", "admin"]);
    const { certificateId } = await context.params;
    const snap = await db
      .collection("auditLogs")
      .where("targetId", "==", certificateId)
      .limit(100)
      .get();
    const events = snap.docs
      .map((doc) => {
        const action: unknown = doc.get("action");
        const actorUid: unknown = doc.get("actorUid");
        const timestamp: unknown = doc.get("timestamp");
        return {
          id: doc.id,
          action: toOptionalString(action),
          actorUid: toOptionalString(actorUid),
          timestamp: toTimestampIso(timestamp),
        };
      })
      .sort((a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""));
    return NextResponse.json(
      { events },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
