import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { db } from "@/src/lib/firebase-admin";
import { apiError, requireRoles, writeAuditLog } from "@/src/lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z
  .object({
    enabled: z.boolean(),
    type: z.enum(["info", "warning"]),
    textEn: z.string().trim().min(1).max(240),
    linkUrl: z
      .string()
      .trim()
      .max(1000)
      .refine((value) => {
        if (!value) return true;
        try {
          return new URL(value).protocol === "https:";
        } catch {
          return false;
        }
      }, "Use a valid HTTPS link"),
    startAt: z
      .string()
      .trim()
      .min(20)
      .max(40)
      .refine(
        (value) =>
          Number.isFinite(Date.parse(value)) &&
          /(?:Z|[+-]\d{2}:\d{2})$/.test(value),
      ),
    endAt: z
      .string()
      .trim()
      .min(20)
      .max(40)
      .refine(
        (value) =>
          Number.isFinite(Date.parse(value)) &&
          /(?:Z|[+-]\d{2}:\d{2})$/.test(value),
      ),
  })
  .refine(
    (value) =>
      new Date(value.endAt).getTime() > new Date(value.startAt).getTime(),
    { message: "End date must be after start date." },
  );
function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/[<>\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["approver", "superadmin"]);
    const snapshot = await db.collection("siteSettings").doc("main").get();
    const value = snapshot.get("announcement");
    return NextResponse.json(
      {
        announcement:
          value && typeof value === "object"
            ? value
            : {
                enabled: false,
                type: "info",
                textEn: "",
                linkUrl: "",
                startAt: "",
                endAt: "",
              },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["approver", "superadmin"]);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error:
            "Provide an announcement, a valid date range and an optional HTTPS link.",
        },
        { status: 400 },
      );
    const value = {
      ...parsed.data,
      textEn: plainText(parsed.data.textEn),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: admin.uid,
    };
    if (!value.textEn)
      return NextResponse.json(
        { error: "Announcement text must not be empty." },
        { status: 400 },
      );
    await db
      .collection("siteSettings")
      .doc("main")
      .set(
        { announcement: value, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    await writeAuditLog(request, admin.uid, "site_announcement.update", "main");
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
