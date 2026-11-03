import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/server/firebase-admin";
import { apiError, requireAdmin, writeAuditLog } from "@/server/security";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z
  .array(
    z.object({
      questionEn: z.string().trim().min(3).max(180),
      answerEn: z.string().trim().min(5).max(1500),
      question_i18n: z.object({
        hi: z.string().max(180).optional(), bn: z.string().max(180).optional(),
        mr: z.string().max(180).optional(), gu: z.string().max(180).optional(),
        pa: z.string().max(180).optional(), ta: z.string().max(180).optional(),
        te: z.string().max(180).optional(), ur: z.string().max(180).optional(),
      }).optional().default({}),
      answer_i18n: z.object({
        hi: z.string().max(1500).optional(), bn: z.string().max(1500).optional(),
        mr: z.string().max(1500).optional(), gu: z.string().max(1500).optional(),
        pa: z.string().max(1500).optional(), ta: z.string().max(1500).optional(),
        te: z.string().max(1500).optional(), ur: z.string().max(1500).optional(),
      }).optional().default({}),
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
      {
        faqs: Array.isArray(s.get("faqs"))
          ? (s.get("faqs") as Record<string, unknown>[]).slice(0, 30).map((item) => ({
              questionEn: String(item.questionEn ?? "").slice(0, 180),
              answerEn: String(item.answerEn ?? "").slice(0, 1500),
              question_i18n: item.question_i18n ?? {},
              answer_i18n: item.answer_i18n ?? {},
            }))
          : [],
      },
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
