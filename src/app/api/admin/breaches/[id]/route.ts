import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { apiError, requireRoles } from "@/server/security";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRoles(request, ["superadmin"]);
    const { id: requestedId } = await context.params;
    const currentReference = db.collection("breaches").doc(requestedId);
    let reference = currentReference;
    let snapshot = await currentReference.get();
    if (!snapshot.exists) {
      reference = db.collection("breachLogs").doc(requestedId);
      snapshot = await reference.get();
    }
    if (!snapshot.exists)
      return NextResponse.json({ error: "Incident not found." }, { status: 404 });
    const [updates, data] = await Promise.all([
      reference === currentReference
        ? reference.collection("updates").orderBy("at", "asc").get()
        : Promise.resolve(null),
      Promise.resolve(snapshot.data() ?? {}),
    ]);
    return NextResponse.json(
      {
        incident: {
          id: requestedId,
          responseTargetHours: Math.max(
            1,
            Number(process.env.BREACH_RESPONSE_TARGET_HOURS ?? 72) || 72,
          ),
          ...Object.fromEntries(
            Object.entries(data).map(([key, value]) => [key, serialize(value)]),
          ),
        },
        updates:
          updates?.docs.map((doc) => ({
            id: doc.id,
            ...Object.fromEntries(
              Object.entries(doc.data()).map(([key, value]) => [key, serialize(value)]),
            ),
          })) ?? [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
