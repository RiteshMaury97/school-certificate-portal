import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "@/src/lib/firebase-admin";
import { apiError, requireAdmin, writeAuditLog } from "@/src/lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z
  .array(
    z.object({
      questionEn: z.string().trim().min(3).max(180),
      answerEn: z.string().trim().min(5).max(1500),
      questionHi: z.string().trim().max(180),
      answerHi: z.string().trim().max(1500),
    }),
  )
  .max(30);
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.role !== "superadmin")
      return NextResponse.json(
        { error: "Superadmin access required." },
        { status: 403 },
      );
    const s = await db.collection("siteSettings").doc("main").get();
    return NextResponse.json(
      { faqs: s.get("faqs") ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.role !== "superadmin")
      return NextResponse.json(
        { error: "Superadmin access required." },
        { status: 403 },
      );
    const parsed = schema.safeParse((await request.json()).faqs);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Check the FAQ content." },
        { status: 400 },
      );
    await db
      .collection("siteSettings")
      .doc("main")
      .set(
        {
          faqs: parsed.data,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: admin.uid,
        },
        { merge: true },
      );
    await writeAuditLog(request, admin.uid, "site_faqs.update", "main");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
