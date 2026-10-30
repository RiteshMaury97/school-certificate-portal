import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "@/src/lib/firebase-admin";
import { apiError, requireAdmin, writeAuditLog } from "@/src/lib/security";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const url = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => !value || /^https:\/\//i.test(value), "Use an HTTPS URL");
const schema = z.object({
  schoolName: z.string().trim().min(1).max(160),
  tagline: z.string().trim().max(240),
  logoUrl: url,
  statusPageUrl: url.optional().default(""),
  includedLanguages: z
    .string()
    .trim()
    .max(150)
    .optional()
    .default("en,hi,bn,mr,gu,pa,ta,te,ur")
    .refine(
      (value) => value.split(",").every((code) => /^[a-z]{2,3}(?:-[a-z]{2})?$/i.test(code.trim())),
      "Use comma-separated language codes",
    ),
  boardName: z.string().trim().max(160),
  affiliationNumber: z.string().trim().max(80),
  schoolCode: z.string().trim().max(80),
  principalPhotoUrl: url,
  principalName: z.string().trim().max(120),
  principalMessage: z.string().trim().max(1800),
  address: z.string().trim().max(500),
  phone: z.string().trim().max(80),
  officeHours: z.string().trim().max(160).optional().default(""),
  mapUrl: url.optional().default(""),
  email: z.string().trim().email().max(254),
  jurisdiction: z.string().trim().max(120),
  socialLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        url: z
          .string()
          .url()
          .refine((v) => /^https:\/\//i.test(v)),
      }),
    )
    .max(12),
  grievanceOfficerName: z.string().trim().max(120),
  grievanceOfficerEmail: z.string().trim().email().max(254),
  grievanceOfficerPhone: z.string().trim().max(80),
  lastUpdated: z.string().trim().max(80),
  maintenanceMode: z.boolean().optional().default(false),
  retentionYears: z.number().int().min(1).max(30).optional().default(7),
  retentionScheduleConfirmed: z.boolean().optional().default(false),
  backupRotationDays: z.number().int().min(7).max(365).optional().default(30),
});
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.role !== "superadmin")
      return NextResponse.json(
        { error: "Superadmin access required." },
        { status: 403 },
      );
    const snapshot = await db.collection("siteSettings").doc("main").get();
    return NextResponse.json(
      { settings: snapshot.exists ? snapshot.data() : {} },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
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
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Please check the branding fields and HTTPS links." },
        { status: 400 },
      );
    const lastUpdated =
      parsed.data.lastUpdated ||
      new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date());
    await db
      .collection("siteSettings")
      .doc("main")
      .set(
        {
          ...parsed.data,
          includedLanguages: Array.from(new Set(["en", ...parsed.data.includedLanguages.split(",").map((code) => code.trim().toLowerCase()).filter(Boolean)])).join(","),
          lastUpdated,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: admin.uid,
        },
        { merge: true },
      );
    await writeAuditLog(request, admin.uid, "site_settings.update", "main");
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
