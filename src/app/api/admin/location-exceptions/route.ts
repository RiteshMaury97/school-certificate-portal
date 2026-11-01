import { randomUUID } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  auditAdminLocation,
  normalizeAdminLocationPolicy,
  readAdminLocationPolicy,
} from "@/server/admin-location";
import { db } from "@/server/firebase-admin";
import { getRequestOrigin } from "@/server/request-origin";
import { apiError, requireRoles } from "@/server/security";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z
  .object({
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
    adminUid: z.string().trim().min(1).max(128).optional(),
    expiresInHours: z.number().int().min(1).max(168),
    reason: z.string().trim().min(5).max(500),
  })
  .refine(
    (value) => Boolean(value.country) !== Boolean(value.adminUid),
    "Choose one country or one administrator.",
  );

export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["superadmin"]);
    const policy = await readAdminLocationPolicy();
    return NextResponse.json(
      { exceptions: policy.adminLocationExceptions },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        {
          error: "Provide one country or administrator, an expiry up to seven days, and a reason.",
        },
        { status: 400 },
      );
    if (parsed.data.adminUid) {
      const targetAdmin = await db.collection("admins").doc(parsed.data.adminUid).get();
      if (!targetAdmin.exists)
        return NextResponse.json({ error: "Administrator not found." }, { status: 404 });
    }
    const now = new Date();
    const exception = {
      id: randomUUID(),
      ...(parsed.data.country ? { country: parsed.data.country } : {}),
      ...(parsed.data.adminUid ? { adminUid: parsed.data.adminUid } : {}),
      expiresAt: new Date(
        now.getTime() + parsed.data.expiresInHours * 60 * 60 * 1000,
      ).toISOString(),
      reason: parsed.data.reason,
      addedBy: admin.uid,
      createdAt: now.toISOString(),
    };
    const settingsRef = db.collection("siteSettings").doc("main");
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(settingsRef);
      const policy = normalizeAdminLocationPolicy(snapshot.data());
      transaction.set(
        settingsRef,
        {
          adminLocationExceptions: [
            ...policy.adminLocationExceptions.filter(
              (item) => Date.parse(item.expiresAt) > now.getTime(),
            ),
            exception,
          ],
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: admin.uid,
        },
        { merge: true },
      );
    });
    const origin = getRequestOrigin(request);
    await auditAdminLocation({
      action: "admin.location.exception_added",
      country: origin.country,
      ip: origin.ip,
      uid: admin.uid,
      targetId: exception.id,
      details: {
        country: exception.country ?? null,
        adminUid: exception.adminUid ?? null,
        expiresAt: exception.expiresAt,
        reason: exception.reason,
      },
    });
    return NextResponse.json(
      { exception },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
