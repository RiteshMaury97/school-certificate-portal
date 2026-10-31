import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/firebase-admin";
import {
  requireRoles,
  requireSensitiveReauth,
  writeAuditLog,
  apiError,
} from "@/server/security";
import { catalogItemSchema, documentIdSchema } from "@/shared/validation";
import { certificateTypeSlug } from "@/server/r2";
export const runtime = "nodejs";
const allowed = ["sessions", "certificateTypes"] as const;
type Kind = (typeof allowed)[number];
function collection(kind: string): Kind | null {
  return allowed.includes(kind as Kind) ? (kind as Kind) : null;
}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ kind: string }> },
) {
  try {
    await requireRoles(request, ["uploader", "approver"]);
    const { kind } = await context.params;
    const name = collection(kind);
    if (!name)
      return NextResponse.json({ error: "Unknown catalog." }, { status: 404 });
    const snap = await db.collection(name).limit(200).get();
    const items = snap.docs
      .map((d) => {
        const data = d.data() as Record<string, unknown>;
        return { ...data, id: d.id };
      })
      .sort((a, b) =>
        String(a.label ?? a.name ?? a.id).localeCompare(
          String(b.label ?? b.name ?? b.id),
        ),
      );
    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ kind: string }> },
) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    const { kind } = await context.params;
    const name = collection(kind);
    if (!name)
      return NextResponse.json({ error: "Unknown catalog." }, { status: 404 });
    const parsed = catalogItemSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Enter a valid catalog name." },
        { status: 400 },
      );
    const label = String(parsed.data.label ?? parsed.data.name);
    const id = String(
      parsed.data.id ??
        (name === "certificateTypes" ? certificateTypeSlug(label) : label),
    );
    await db
      .collection(name)
      .doc(id)
      .set(
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
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ kind: string }> },
) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    await requireSensitiveReauth(request, admin);
    const { kind } = await context.params;
    const name = collection(kind);
    const id = request.nextUrl.searchParams.get("id");
    if (!name || !id || !documentIdSchema.safeParse(id).success)
      return NextResponse.json(
        { error: "Invalid catalog item." },
        { status: 400 },
      );
    await db.collection(name).doc(id).delete();
    await writeAuditLog(request, admin.uid, `${name}.delete`, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
