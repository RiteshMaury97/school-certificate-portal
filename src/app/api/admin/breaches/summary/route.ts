import { NextResponse } from "next/server";

import { listBreaches } from "@/server/breaches";
import { apiError, requireRoles } from "@/server/security";

import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["superadmin"]);
    const statuses = ["reported", "investigating", "contained", "notified"];
    const targetHours = Math.max(1, Number(process.env.BREACH_RESPONSE_TARGET_HOURS ?? 72) || 72);
    const results = await Promise.all(
      statuses.map((status) =>
        listBreaches({
          status,
          severity: null,
          start: null,
          end: null,
          search: "",
          page: 1,
          pageSize: 1000,
        }),
      ),
    );
    const open = results.flatMap((result) => result.breaches);
    const overdue = open.filter((record) => {
      const discovered =
        typeof record.discoveredAt === "string" ? Date.parse(record.discoveredAt) : Number.NaN;
      return Number.isFinite(discovered) && Date.now() - discovered > targetHours * 3_600_000;
    }).length;
    return NextResponse.json(
      {
        openCount: results.reduce((total, result) => total + result.total, 0),
        overdueCount: overdue,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
