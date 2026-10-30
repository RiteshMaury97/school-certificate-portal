import { NextResponse } from "next/server";
import { db } from "@/src/lib/firebase-admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const snapshot = await db.collection("siteSettings").doc("main").get();
    const data = snapshot.exists ? (snapshot.data() ?? {}) : {};
    const safe = {
      maintenanceMode: data.maintenanceMode === true,
      retentionScheduleConfirmed: data.retentionScheduleConfirmed === true,
      retentionYears: Math.max(
        1,
        Math.min(30, Number(data.retentionYears ?? 7)),
      ),
      backupRotationDays: Math.max(
        7,
        Math.min(365, Number(data.backupRotationDays ?? 30)),
      ),
      schoolName: String(data.schoolName ?? ""),
      includedLanguages:
        typeof data.includedLanguages === "string"
          ? data.includedLanguages
              .split(",")
              .map((code: string) => code.trim().toLowerCase())
              .filter((code: string) => /^[a-z]{2,3}(?:-[a-z]{2})?$/i.test(code))
              .slice(0, 30)
              .join(",")
          : "en,hi,bn,mr,gu,pa,ta,te,ur",
      tagline: String(data.tagline ?? ""),
      logoUrl: String(data.logoUrl ?? ""),
      statusPageUrl:
        typeof data.statusPageUrl === "string" &&
        /^https:\/\//i.test(data.statusPageUrl)
          ? data.statusPageUrl
          : "",
      boardName: String(data.boardName ?? ""),
      affiliationNumber: String(data.affiliationNumber ?? ""),
      schoolCode: String(data.schoolCode ?? ""),
      principalPhotoUrl: String(data.principalPhotoUrl ?? ""),
      principalName: String(data.principalName ?? ""),
      principalMessage: String(data.principalMessage ?? ""),
      address: String(data.address ?? ""),
      phone: String(data.phone ?? ""),
      email: String(data.email ?? ""),
      jurisdiction: String(data.jurisdiction ?? ""),
      officeHours: String(data.officeHours ?? ""),
      mapUrl:
        typeof data.mapUrl === "string" && /^https:\/\//i.test(data.mapUrl)
          ? data.mapUrl
          : "",
      faqs: Array.isArray(data.faqs)
        ? data.faqs
            .slice(0, 30)
            .map((item: Record<string, unknown>) => ({
              questionEn: String(item.questionEn ?? "").slice(0, 180),
              answerEn: String(item.answerEn ?? "").slice(0, 1500),
            }))
        : [],
      socialLinks: Array.isArray(data.socialLinks)
        ? data.socialLinks
            .filter(
              (item): item is { label: string; url: string } =>
                typeof item === "object" &&
                item !== null &&
                "label" in item &&
                "url" in item &&
                typeof item.label === "string" &&
                item.label.length <= 40 &&
                typeof item.url === "string" &&
                /^https:\/\//i.test(item.url),
            )
            .map((item) => ({ label: item.label, url: item.url }))
        : [],
      grievanceOfficerName: String(data.grievanceOfficerName ?? ""),
      grievanceOfficerEmail: String(data.grievanceOfficerEmail ?? ""),
      grievanceOfficerPhone: String(data.grievanceOfficerPhone ?? ""),
      lastUpdated: String(data.lastUpdated ?? ""),
      announcement: (() => {
        const a =
          data.announcement && typeof data.announcement === "object"
            ? (data.announcement as Record<string, unknown>)
            : null;
        if (
          !a ||
          a.enabled !== true ||
          !["info", "warning"].includes(String(a.type))
        )
          return null;
        const start = Date.parse(String(a.startAt ?? "")),
          end = Date.parse(String(a.endAt ?? "")),
          now = Date.now();
        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          start > now ||
          end <= now
        )
          return null;
        const text = (value: unknown) =>
          typeof value === "string"
            ? value
                .replace(/<[^>]*>/g, "")
                .replace(/[<>\u0000-\u001f\u007f]/g, " ")
                .slice(0, 240)
            : "";
        const textEn = text(a.textEn);
        if (!textEn) return null;
        return {
          type: a.type,
          textEn,
          linkUrl:
            typeof a.linkUrl === "string" && /^https:\/\//i.test(a.linkUrl)
              ? a.linkUrl
              : "",
        };
      })(),
    };
    return NextResponse.json(
      { settings: safe },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { settings: {} },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
