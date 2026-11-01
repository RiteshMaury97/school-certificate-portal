import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { apiError, requireRoles } from "@/server/security";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    await requireRoles(request, ["approver", "admin"]);
    const { certificateId } = await context.params;
    const certificate = await db.collection("certificates").doc(certificateId).get();
    if (!certificate.exists || certificate.get("status") !== "pending")
      return NextResponse.json({ error: "Pending certificate not found." }, { status: 404 });
    const r2Key = String(certificate.get("r2Key") ?? "");
    if (!r2Key) return NextResponse.json({ error: "Preview unavailable." }, { status: 404 });
    const mimeType = String(certificate.get("mimeType") ?? "");
    return NextResponse.json(
      {
        url: `/api/admin/certificates/${encodeURIComponent(certificateId)}/preview-file`,
        mimeType,
        expiresIn: 60,
      },
      {
        headers: {
          "Cache-Control": "no-store, private",
          Pragma: "no-cache",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
