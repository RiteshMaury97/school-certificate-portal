import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import { enforceAdminLocation } from "@/server/admin-location";
import { db } from "@/server/firebase-admin";
import { apiError, requireAdmin, writeAuditLog } from "@/server/security";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    type: z.enum(["country", "admin"]),
    country: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .optional(),
    adminUid: z.string().trim().min(1).max(128).optional(),
    expiresAt: z.iso.datetime(),
    reason: z.string().trim().min(8).max(500),
  })
  .superRefine((value, context) => {
    if (value.type === "country" && !value.country)
      context.addIssue({ code: "custom", path: ["country"], message: "Choose a country." });
    if (value.type === "admin" && !value.adminUid)
      context.addIssue({ code: "custom", path: ["adminUid"], message: "Choose an administrator." });
  });

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.role !== "superadmin")
      return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
    const locationDenied = await enforceAdminLocation(request, admin.uid);
    if (locationDenied) return locationDenied;
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Check the temporary exception details." },
        { status: 400 },
      );
    const expiresAt = new Date(parsed.data.expiresAt);
    const duration = expiresAt.getTime() - Date.now();
    if (duration <= 0 || duration > 7 * 24 * 60 * 60_000)
      return NextResponse.json(
        { error: "An exception must expire within the next 7 days." },
        { status: 400 },
      );
    const country = parsed.data.country?.toUpperCase();
    const targetUid = parsed.data.adminUid;
    if (parsed.data.type === "country" && !country)
      return NextResponse.json({ error: "Choose a country." }, { status: 400 });
    if (parsed.data.type === "admin" && !targetUid)
      return NextResponse.json({ error: "Choose an administrator." }, { status: 400 });
    if (parsed.data.type === "admin" && targetUid) {
      const target = await db.collection("admins").doc(targetUid).get();
      if (!target.exists)
        return NextResponse.json({ error: "Administrator not found." }, { status: 404 });
    }
    const exception = await db.collection("adminLocationExceptions").add({
      type: parsed.data.type,
      ...(parsed.data.type === "country" ? { country } : { adminUid: targetUid }),
      expiresAt,
      reason: parsed.data.reason,
      createdBy: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    await writeAuditLog(
      request,
      admin.uid,
      "admin.location.exception.add",
      exception.id,
      undefined,
      {
        changedFields: [
          parsed.data.type === "country" ? `country:${country}` : `admin:${targetUid}`,
          `expires:${expiresAt.toISOString()}`,
          `reason:${parsed.data.reason}`,
        ],
      },
    );
    return NextResponse.json(
      { ok: true, id: exception.id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (admin.role !== "superadmin")
      return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
    const locationDenied = await enforceAdminLocation(request, admin.uid);
    if (locationDenied) return locationDenied;
    const id = request.nextUrl.searchParams.get("id") ?? "";
    if (!/^[A-Za-z0-9_-]{10,150}$/.test(id))
      return NextResponse.json({ error: "Invalid exception." }, { status: 400 });
    const ref = db.collection("adminLocationExceptions").doc(id);
    const existing = await ref.get();
    if (!existing.exists)
      return NextResponse.json({ error: "Exception not found." }, { status: 404 });
    await ref.delete();
    await writeAuditLog(request, admin.uid, "admin.location.exception.revoke", id, undefined, {
      changedFields: ["exception revoked"],
    });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
