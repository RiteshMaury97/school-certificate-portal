import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { requireRoles, apiError } from "@/server/security";
import { auditFilterSchema } from "@/shared/validation";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["approver", "superadmin"]);
    const filters = auditFilterSchema.safeParse({
      start: request.nextUrl.searchParams.get("start") ?? undefined,
      end: request.nextUrl.searchParams.get("end") ?? undefined,
      action: request.nextUrl.searchParams.get("action") ?? undefined,
    });
    if (!filters.success)
      return NextResponse.json(
        { error: "Invalid audit filters." },
        { status: 400 },
      );
    const { start, end, action } = filters.data;
    const exporting = request.nextUrl.searchParams.get("format") === "csv";
    let query = db
      .collection("auditLogs")
      .orderBy("timestamp", "desc")
      .limit(exporting ? 5000 : 300);
    if (start) query = query.where("timestamp", ">=", new Date(start));
    if (end) query = query.where("timestamp", "<=", new Date(end));
    if (action) query = query.where("action", "==", action);
    const snap = await query.get();
    type AuditRow = {
      id: string;
      timestamp: string | null;
      actorUid: string | undefined;
      action: string | undefined;
      targetId: string | undefined;
      ipHash: string | undefined;
    };
    const logs: AuditRow[] = snap.docs.map((d) => {
      const rawData: unknown = d.data();
      const data = isRecord(rawData) ? rawData : {};
      const rawTimestamp: unknown = d.get("timestamp");
      const timestampValue = rawTimestamp instanceof Timestamp ? rawTimestamp.toDate() : undefined;
      return {
        id: d.id,
        timestamp: timestampValue?.toISOString() ?? null,
        actorUid: typeof data.actorUid === "string" ? data.actorUid : undefined,
        action: typeof data.action === "string" ? data.action : undefined,
        targetId: typeof data.targetId === "string" ? data.targetId : undefined,
        ipHash: typeof data.ipHash === "string" ? data.ipHash : undefined,
      };
    });
    if (exporting) {
      const lines = [
        "timestamp,actorUid,action,targetId,ipHash",
        ...logs.map((x) =>
          [x.timestamp, x.actorUid, x.action, x.targetId, x.ipHash]
            .map((v) => `"${(v ?? "").replace(/"/g, '""')}"`)
            .join(","),
        ),
      ];
      return new NextResponse(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=audit-logs.csv",
          "Cache-Control": "no-store",
        },
      });
    }
    return NextResponse.json(
      { logs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
