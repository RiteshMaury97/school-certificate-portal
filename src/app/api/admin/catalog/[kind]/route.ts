import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { certificateTypeSlug } from "@/server/r2";
import { requireRoles, writeAuditLog, apiError } from "@/server/security";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { catalogItemSchema, documentIdSchema } from "@/shared/validation";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
const allowed = ["sessions", "certificateTypes", "classes"] as const;
type Kind = (typeof allowed)[number];
function collection(kind: string): Kind | null {
  return allowed.find((candidate) => candidate === kind) ?? null;
}
function resolveCatalogLabel(name: Kind, requestedLabel: string): string | null {
  const sessionLabel = name === "sessions" ? normalizeAcademicSession(requestedLabel) : null;
  if (name === "sessions" && !sessionLabel) return null;
  return sessionLabel ?? requestedLabel;
}
export async function GET(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try {
    await requireRoles(request, ["uploader", "approver", "admin"]);
    const { kind } = await context.params;
    const name = collection(kind);
    if (!name) return NextResponse.json({ error: "Unknown catalog." }, { status: 404 });
    const snap = await db.collection(name).limit(200).get();
    const items: Record<string, unknown>[] = snap.docs
      .map((d): Record<string, unknown> => {
        const data = d.data() as Record<string, unknown>;
        return { ...data, id: d.id };
      })
      .sort((a, b) =>
        String(a.label ?? a.name ?? a.id).localeCompare(String(b.label ?? b.name ?? b.id)),
      );
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try {
    const admin = await requireRoles(request, ["superadmin", "admin"]);
    const { kind } = await context.params;
    const name = collection(kind);
    if (!name) return NextResponse.json({ error: "Unknown catalog." }, { status: 404 });
    const parsed = catalogItemSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json({ error: "Enter a valid catalog name." }, { status: 400 });
    const requestedLabel = parsed.data.label ?? parsed.data.name ?? "";
    const label = resolveCatalogLabel(name, requestedLabel);
    if (!label)
      return NextResponse.json(
        { error: "Use an academic session like 2026-27 or 2026-2027." },
        { status: 400 },
      );
    const idValue =
      (name === "sessions" ? label : parsed.data.id) ??
      (name === "certificateTypes" || name === "classes" ? certificateTypeSlug(label) : label);
    const id = idValue;
    await db.collection(name).doc(id).set(
      {
        label,
        name: label,
        isActive: true,
        updatedAt: new Date(),
        updatedBy: admin.uid,
      },
      { merge: true },
    );
    await writeAuditLog(request, admin.uid, `${name}.upsert`, id);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return apiError(e);
  }
}
export async function DELETE(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  try {
    const admin = await requireRoles(request, ["superadmin", "admin"]);
    const { kind } = await context.params;
    const name = collection(kind);
    const id = request.nextUrl.searchParams.get("id");
    if (!name || !id || !documentIdSchema.safeParse(id).success)
      return NextResponse.json({ error: "Invalid catalog item." }, { status: 400 });
    await db.collection(name).doc(id).delete();
    await writeAuditLog(request, admin.uid, `${name}.delete`, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
