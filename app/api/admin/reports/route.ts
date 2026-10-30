import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "@/src/lib/firebase-admin";
import { apiError, requireRoles, writeAuditLog } from "@/src/lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["approver"]);
    const snap = await db
      .collection("recordReports")
      .orderBy("createdAt", "desc")
      .limit(200)
      .get();
    return NextResponse.json(
      {
        reports: snap.docs.map((d) => {
          const { ipHash: _ipHash, ...safe } = d.data();
          return {
            id: d.id,
            ...safe,
            createdAt: d.get("createdAt")?.toDate?.()?.toISOString?.() ?? null,
          };
        }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["approver"]);
    const parsed = z
      .object({
        id: z.string().regex(/^SIS-\d{4}-[A-F0-9]{8}$/),
        status: z.enum(["open", "reviewing", "resolved", "rejected"]),
        adminNote: z.string().trim().max(1000).optional(),
      })
      .safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid report update." },
        { status: 400 },
      );
    await db
      .collection("recordReports")
      .doc(parsed.data.id)
      .update({
        status: parsed.data.status,
        adminNote: parsed.data.adminNote ?? "",
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: admin.uid,
      });
    await writeAuditLog(
      request,
      admin.uid,
      "record_report.updated",
      parsed.data.id,
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
