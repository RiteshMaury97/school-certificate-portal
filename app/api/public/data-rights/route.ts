import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/firebase-admin";
import {
  hashRequesterIp,
  verifyRequestAppCheck,
  writeAuditLog,
} from "@/src/lib/security";
import { z } from "zod";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const requestSchema = z.object({
  requestType: z.enum(["access", "correction", "erasure"]),
  requesterName: z.string().trim().min(2).max(100),
  contactEmail: z.string().trim().email().max(254),
  studentName: z.string().trim().min(2).max(100),
  description: z.string().trim().min(10).max(1500),
  guardianConfirmation: z.literal(true),
});
export async function POST(request: NextRequest) {
  try {
    await verifyRequestAppCheck(request);
    if (
      !request.headers.get("origin") ||
      request.headers.get("origin") !== process.env.APP_ORIGIN
    )
      return NextResponse.json(
        { error: "Request could not be submitted." },
        { status: 403 },
      );
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Please check the request details." },
        { status: 400 },
      );
    const id = `SIS-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    await db
      .collection("dataRightsRequests")
      .doc(id)
      .create({
        ...parsed.data,
        acknowledgmentId: id,
        status: "open",
        policyVersion: process.env.PRIVACY_POLICY_VERSION ?? "2026-10",
        ipHash: hashRequesterIp(request),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    await writeAuditLog(request, "public", "data_rights.request", id);
    return NextResponse.json(
      { ok: true, acknowledgmentId: id },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error: "The request could not be submitted. Please contact the school.",
      },
      { status: 500 },
    );
  }
}
