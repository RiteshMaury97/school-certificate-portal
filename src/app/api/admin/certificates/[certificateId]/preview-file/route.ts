import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { createCertificatePreviewUrl } from "@/server/r2";
import { apiError, requireRoles } from "@/server/security";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

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
    const mimeType = String(certificate.get("mimeType") ?? "");
    if (!r2Key || !allowedMimeTypes.has(mimeType))
      return NextResponse.json({ error: "Preview unavailable." }, { status: 404 });

    const signedUrl = await createCertificatePreviewUrl(r2Key);
    const upstream = await fetch(signedUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!upstream.ok || !upstream.body)
      return NextResponse.json(
        { error: "The certificate file could not be loaded." },
        { status: 502 },
      );

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": "inline",
        "Cache-Control": "no-store, private",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'",
        "X-Frame-Options": "SAMEORIGIN",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
