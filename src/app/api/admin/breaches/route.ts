import { NextResponse } from "next/server";

import { createBreach, listBreaches, updateBreach } from "@/server/breaches";
import { apiError, requireRoles, writeAuditLog } from "@/server/security";
import { breachCreateSchema } from "@/shared/breach-schema";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function filterError(
  status: string | null,
  severity: string | null,
  start: string | null,
  end: string | null,
): string | null {
  const validStatuses = ["reported", "investigating", "contained", "notified", "closed"];
  const validSeverities = ["low", "medium", "high", "critical"];
  if (status && !validStatuses.includes(status)) return "Invalid status filter.";
  if (severity && !validSeverities.includes(severity)) return "Invalid severity filter.";
  if ((start && !Number.isFinite(Date.parse(start))) || (end && !Number.isFinite(Date.parse(end))))
    return "Invalid date range.";
  return null;
}

function parseListFilters(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const status = params.get("status");
  const severity = params.get("severity");
  const start = params.get("start");
  const end = params.get("end");
  const search = (params.get("search") ?? "").trim().slice(0, 160);
  const error = filterError(status, severity, start, end);
  if (error) return { error };
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(params.get("pageSize") ?? 25) || 25));
  return { status, severity, start, end, search, page, pageSize };
}

export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["superadmin"]);
    const filters = parseListFilters(request);
    if ("error" in filters) return NextResponse.json({ error: filters.error }, { status: 400 });
    const { breaches, total } = await listBreaches(filters);
    const pageSize = filters.pageSize;
    return NextResponse.json(
      {
        breaches,
        page: filters.page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    const body: unknown = await request.json();
    const valid = breachCreateSchema.safeParse(body);
    if (!valid.success)
      return NextResponse.json(
        { error: "Provide all required incident details and start at reported status." },
        { status: 400 },
      );
    const result = await createBreach(valid.data, admin.uid);
    if (result.error)
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    const id = result.id ?? "";
    await writeAuditLog(
      request,
      admin.uid,
      "breach.created",
      id,
      undefined,
      result.fields
        ? {
            changedFields: result.fields,
          }
        : undefined,
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    const body: unknown = await request.json();
    const id =
      typeof body === "object" && body !== null && "id" in body && typeof body.id === "string"
        ? body.id
        : "";
    if (!id) return NextResponse.json({ error: "Incident ID is required." }, { status: 400 });
    const result = await updateBreach(id, body, admin.uid);
    if (result.error)
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    await writeAuditLog(
      request,
      admin.uid,
      "breach.updated",
      id,
      undefined,
      result.fields
        ? {
            changedFields: result.fields,
          }
        : undefined,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
