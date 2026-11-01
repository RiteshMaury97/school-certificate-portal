import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/firebase-admin";
import { apiError, requireRoles, writeAuditLog } from "@/server/security";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
const schema = z.object({
  summary: z.string().trim().min(10).max(2000),
  discoveredAt: z.iso.datetime({ offset: true }),
  affectedData: z.string().trim().min(3).max(500),
  affectedPrincipalsEstimate: z.number().int().min(0).max(1000000),
  boardNotifiedAt: z.iso.datetime({ offset: true }).optional(),
  boardDetailedReportAt: z.iso.datetime({ offset: true }).optional(),
  principalsNotifiedAt: z.iso.datetime({ offset: true }).optional(),
  status: z.enum(["investigating", "contained", "notified", "closed"]),
});
export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["superadmin"]);
    const snap = await db.collection("breachLogs").orderBy("createdAt", "desc").limit(100).get();
    const iso = (v: unknown) =>
      v && typeof v === "object" && "toDate" in v && typeof v.toDate === "function"
        ? v.toDate().toISOString()
        : (v ?? null);
    return NextResponse.json(
      {
        breaches: snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            ...x,
            discoveredAt: iso(x.discoveredAt),
            boardNotifiedAt: iso(x.boardNotifiedAt),
            boardDetailedReportAt: iso(x.boardDetailedReportAt),
            principalsNotifiedAt: iso(x.principalsNotifiedAt),
            createdAt: iso(x.createdAt),
          };
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid incident details." }, { status: 400 });
    const data = parsed.data;
    const ref = await db.collection("breachLogs").add({
      ...data,
      discoveredAt: new Date(data.discoveredAt),
      boardNotifiedAt: data.boardNotifiedAt ? new Date(data.boardNotifiedAt) : null,
      boardDetailedReportAt: data.boardDetailedReportAt
        ? new Date(data.boardDetailedReportAt)
        : null,
      principalsNotifiedAt: data.principalsNotifiedAt ? new Date(data.principalsNotifiedAt) : null,
      createdBy: admin.uid,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await writeAuditLog(request, admin.uid, "breach.created", ref.id);
    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}

const updateSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    status: z.enum(["investigating", "contained", "notified", "closed"]).optional(),
    boardNotifiedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    boardDetailedReportAt: z.iso.datetime({ offset: true }).nullable().optional(),
    principalsNotifiedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  })
  .refine(
    (v) =>
      v.status !== undefined ||
      v.boardNotifiedAt !== undefined ||
      v.boardDetailedReportAt !== undefined ||
      v.principalsNotifiedAt !== undefined,
  );
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Invalid incident update." }, { status: 400 });
    const { id, ...values } = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (values.status) patch.status = values.status;
    if (values.boardNotifiedAt !== undefined)
      patch.boardNotifiedAt = values.boardNotifiedAt ? new Date(values.boardNotifiedAt) : null;
    if (values.boardDetailedReportAt !== undefined)
      patch.boardDetailedReportAt = values.boardDetailedReportAt
        ? new Date(values.boardDetailedReportAt)
        : null;
    if (values.principalsNotifiedAt !== undefined)
      patch.principalsNotifiedAt = values.principalsNotifiedAt
        ? new Date(values.principalsNotifiedAt)
        : null;
    await db.collection("breachLogs").doc(id).update(patch);
    await writeAuditLog(request, admin.uid, "breach.updated", id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
