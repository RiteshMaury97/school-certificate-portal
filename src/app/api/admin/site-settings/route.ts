import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  defaultAdminLocationPolicy,
  getAdminLocationPolicy,
  isValidIpCidr,
  listAdminLocationExceptions,
} from "@/server/admin-location";
import { db } from "@/server/firebase-admin";
import { apiError, requireAdmin, writeAuditLog } from "@/server/security";

import type { NextRequest } from "next/server";
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
  email: z.email().trim().max(254),
  jurisdiction: z.string().trim().max(120),
  socialLinks: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        url: z.url().refine((v) => /^https:\/\//i.test(v)),
      }),
    )
    .max(12),
  grievanceOfficerName: z.string().trim().max(120),
  grievanceOfficerEmail: z.email().trim().max(254),
  grievanceOfficerPhone: z.string().trim().max(80),
  lastUpdated: z.string().trim().max(80),
  maintenanceMode: z.boolean().optional().default(false),
  emergencyLockdown: z.boolean().optional().default(false),
  retentionYears: z.number().int().min(1).max(30).optional().default(7),
  backupRotationDays: z.number().int().min(7).max(365).optional().default(30),
  allowedAdminCountries: z
    .array(z.string().regex(/^[A-Za-z]{2}$/))
    .max(30)
    .optional(),
  adminIpAllowlist: z
    .array(z.string().max(80).refine(isValidIpCidr, "Enter valid IP addresses or CIDR ranges."))
    .max(100)
    .optional(),
  adminEnforcementMode: z.enum(["off", "alert", "block"]).optional(),
});
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.role !== "superadmin")
      return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
    const [snapshot, policy, exceptions, auditSnapshot] = await Promise.all([
      db.collection("siteSettings").doc("main").get(),
      getAdminLocationPolicy(),
      listAdminLocationExceptions(),
      db.collection("auditLogs").orderBy("timestamp", "desc").limit(100).get(),
    ]);
    const recentLocationBlocks = auditSnapshot.docs
      .filter((document) => document.get("action") === "admin.location.block")
      .slice(0, 10)
      .map((document) => {
        const timestamp = document.get("timestamp");
        return {
          id: document.id,
          country: String(document.get("country") ?? ""),
          reason: String(document.get("reason") ?? ""),
          timestamp:
            timestamp && typeof timestamp.toDate === "function"
              ? timestamp.toDate().toISOString()
              : null,
        };
      });
    const storedSettings = snapshot.exists ? (snapshot.data() ?? {}) : {};
    const defaults = defaultAdminLocationPolicy();
    return NextResponse.json(
      {
        settings: {
          ...storedSettings,
          allowedAdminCountries: policy.allowedAdminCountries ?? defaults.allowedAdminCountries,
          adminIpAllowlist: policy.adminIpAllowlist ?? defaults.adminIpAllowlist,
          adminEnforcementMode: policy.adminEnforcementMode ?? defaults.adminEnforcementMode,
        },
        locationExceptions: exceptions.map((exception) => {
          const expiresAt = exception.expiresAt as { toDate?: () => Date } | Date | undefined;
          return {
            ...exception,
            expiresAt:
              expiresAt instanceof Date
                ? expiresAt.toISOString()
                : (expiresAt?.toDate?.().toISOString() ?? null),
          };
        }),
        recentLocationBlocks,
      },
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
    const previousSettings = await db.collection("siteSettings").doc("main").get();
    const wasEmergencyLocked = previousSettings.get("emergencyLockdown") === true;
    await db
      .collection("siteSettings")
      .doc("main")
      .set(
        {
          ...parsed.data,
          ...(parsed.data.allowedAdminCountries
            ? {
                allowedAdminCountries: [
                  ...new Set(
                    parsed.data.allowedAdminCountries.map((country) => country.toUpperCase()),
                  ),
                ],
              }
            : {}),
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
    await writeAuditLog(request, admin.uid, "site_settings.update", "main", undefined, {
      changedFields: [...Object.keys(parsed.data)],
    });
    if (parsed.data.emergencyLockdown !== wasEmergencyLocked)
      await writeAuditLog(
        request,
        admin.uid,
        parsed.data.emergencyLockdown
          ? "emergency_lockdown.enabled"
          : "emergency_lockdown.disabled",
        "main",
      );
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
