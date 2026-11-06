import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidCidr, normalizeAdminLocationPolicy } from "@/server/admin-location";
import { db } from "@/server/firebase-admin";
import { apiError, requireAdmin, writeAuditLog } from "@/server/security";
import { PUBLIC_SITE_SETTINGS_TAG } from "@/server/site-settings-cache";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const url = z
  .string()
  .trim()
  .max(1000)
  .refine((value) => !value || isHttpsUrl(value), "Use an HTTPS URL");

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isLanguageCode(value: string): boolean {
  const parts = value.trim().split("-");
  if (parts.length > 2) return false;
  const [language = "", region] = parts;
  const hasAsciiLetters = (part: string, min: number, max: number) => {
    if (part.length < min || part.length > max) return false;
    for (const character of part.toLowerCase()) {
      if (character < "a" || character > "z") return false;
    }
    return true;
  };
  return hasAsciiLetters(language, 2, 3) && (region === undefined || hasAsciiLetters(region, 2, 2));
}
const localeText = z
  .object({
    hi: z.string().max(1800).optional(),
    bn: z.string().max(1800).optional(),
    mr: z.string().max(1800).optional(),
    gu: z.string().max(1800).optional(),
    pa: z.string().max(1800).optional(),
    ta: z.string().max(1800).optional(),
    te: z.string().max(1800).optional(),
    ur: z.string().max(1800).optional(),
  })
  .optional()
  .default({});
const schema = z.object({
  schoolName: z.string().trim().min(1).max(160),
  tagline: z.string().trim().max(240),
  tagline_i18n: localeText,
  statusPageUrl: url.optional().default(""),
  includedLanguages: z
    .string()
    .trim()
    .max(150)
    .optional()
    .default("en,hi,bn,mr,gu,pa,ta,te,ur")
    .refine(
      (value) => value.split(",").every(isLanguageCode),
      "Use comma-separated language codes",
    ),
  boardName: z.string().trim().max(160),
  affiliationNumber: z.string().trim().max(80),
  schoolCode: z.string().trim().max(80),
  website: url.optional().default(""),
  principalPhotoUrl: url,
  principalName: z.string().trim().max(120),
  principalMessage: z.string().trim().max(1800),
  principalMessage_i18n: localeText,
  address: z.string().trim().max(500),
  phone: z.string().trim().max(80),
  officeHours: z.string().trim().max(160).optional().default(""),
  mapUrl: url.optional().default(""),
  email: z.string().trim().max(254).refine((value) => z.email().safeParse(value).success),
  jurisdiction: z.string().trim().max(120),
  socialLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
      url: z.url().refine(isHttpsUrl),
      }),
    )
    .max(12),
  grievanceOfficerName: z.string().trim().max(120),
  grievanceOfficerEmail: z
    .string()
    .trim()
    .max(254)
    .refine((value) => z.email().safeParse(value).success),
  securityContactEmail: z
    .string()
    .trim()
    .max(254)
    .refine((value) => !value || z.email().safeParse(value).success, "Enter a valid email address")
    .optional()
    .default(""),
  grievanceOfficerPhone: z.string().trim().max(80),
  lastUpdated: z.string().trim().max(80),
  maintenanceMode: z.boolean().optional().default(false),
  retentionYears: z.number().int().min(1).max(30).optional().default(7),
  backupRotationDays: z.number().int().min(7).max(365).optional().default(30),
  allowedAdminCountries: z
    .array(z.string().regex(/^[A-Z]{2}$/))
    .max(250)
    .optional()
    .default(["IN"]),
  adminIpAllowlist: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(100)
        .refine(isValidCidr, "Enter an IPv4 or IPv6 CIDR, such as 203.0.113.0/24."),
    )
    .max(100)
    .optional()
    .default([]),
  adminLocationEnforcementMode: z.enum(["off", "alert", "block"]).optional(),
});
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.role !== "superadmin")
      return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
    const snapshot = await db.collection("siteSettings").doc("main").get();
    const locationPolicy = normalizeAdminLocationPolicy(snapshot.data());
    const recent = await db.collection("auditLogs").orderBy("timestamp", "desc").limit(100).get();
    const recentLocationBlocks = recent.docs
      .filter((document) =>
        [
          "admin.location.blocked",
          "admin.location.alert",
          "admin.location.session_country_changed",
        ].includes(String(document.get("action"))),
      )
      .slice(0, 10)
      .map((document) => {
        const timestamp: unknown = document.get("timestamp");
        const date = timestamp instanceof Timestamp ? timestamp.toDate() : null;
        return {
          action: String(document.get("action")),
          country: String(document.get("country") ?? "Unknown"),
          at: date?.toISOString() ?? null,
        };
      });
    return NextResponse.json(
      { settings: { ...(snapshot.data() ?? {}), ...locationPolicy }, recentLocationBlocks },
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
      return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
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
    const settingsRef = db.collection("siteSettings").doc("main");
    const previous = await settingsRef.get();
    const wasLockedDown = previous.get("maintenanceMode") === true;
    await settingsRef.set(
      {
        ...parsed.data,
        adminLocationEnforcementMode:
          parsed.data.adminLocationEnforcementMode ??
          (process.env.NODE_ENV === "production" ? "block" : "off"),
        includedLanguages: Array.from(
          new Set([
            "en",
            ...parsed.data.includedLanguages
              .split(",")
              .map((code) => code.trim().toLowerCase())
              .filter(Boolean),
          ]),
        ).join(","),
        lastUpdated,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: admin.uid,
      },
      { merge: true },
    );
    revalidateTag(PUBLIC_SITE_SETTINGS_TAG, { expire: 0 });
    await writeAuditLog(request, admin.uid, "site_settings.update", "main");
    if (parsed.data.maintenanceMode !== wasLockedDown)
      await writeAuditLog(
        request,
        admin.uid,
        parsed.data.maintenanceMode
          ? "admin.emergency_lockdown.enabled"
          : "admin.emergency_lockdown.disabled",
        "public-endpoints",
      );
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
