import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/firebase-admin";
import { createCertificatePreviewUrl } from "@/src/lib/r2";
import { apiError, requireRoles } from "@/src/lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ certificateId: string }> },
) {
  try {
    await requireRoles(request, ["approver"]);
    const { certificateId } = await context.params;
    const certificate = await db
      .collection("certificates")
      .doc(certificateId)
      .get();
    if (!certificate.exists || certificate.get("status") !== "pending")
      return NextResponse.json(
        { error: "Pending certificate not found." },
        { status: 404 },
      );
    const r2Key = String(certificate.get("r2Key") ?? "");
    if (!r2Key)
      return NextResponse.json(
        { error: "Preview unavailable." },
        { status: 404 },
      );
    const url = await createCertificatePreviewUrl(r2Key);
    return NextResponse.json(
      {
        url,
        mimeType: String(certificate.get("mimeType") ?? ""),
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
