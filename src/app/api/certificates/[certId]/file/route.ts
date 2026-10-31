import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/firebase-admin";
import { readR2Object } from "@/server/r2";
import { watermarkCertificate } from "@/server/watermark";
import { recordCertificateDownloads } from "@/server/download-metrics";
import { isPubliclyDownloadableStatus } from "@/shared/certificate-lifecycle";
import {
  studentAccessTokenOwnsStudent,
  verifyStudentAccessToken,
} from "@/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return NextResponse.json(
    { error: "Certificate unavailable." },
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
function safeDispositionName(originalName: string, extension: string): string {
  const base =
    originalName.replace(/[\\/\r\n"]/g, "_").slice(0, 120) ||
    `certificate${extension}`;
  const ascii = base.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(base).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ certId: string }> },
) {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const claims = verifyStudentAccessToken(token, request);
    if (!claims) return unavailable();

    const { certId } = await context.params;
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(certId)) return unavailable();

    const matches = await db
      .collection("certificates")
      .where("publicId", "==", certId)
      .limit(2)
      .get();
    if (matches.size !== 1) return unavailable();

    const certificateDoc = matches.docs[0]!;
    const certificate = certificateDoc.data();
    if (
      !isPubliclyDownloadableStatus(certificate.status) ||
      certificate.published === false
    )
      return unavailable();
    const studentId = String(certificate.studentId ?? "");
    if (!studentAccessTokenOwnsStudent(claims, studentId)) return unavailable();
    const student = studentId
      ? await db.collection("students").doc(studentId).get()
      : null;
    if (!student?.exists || student.get("erasurePending") === true)
      return unavailable();

    const mimeType = String(certificate.mimeType ?? "");
    const extension =
      mimeType === "application/pdf"
        ? ".pdf"
        : mimeType === "image/jpeg"
          ? ".jpg"
          : mimeType === "image/png"
            ? ".png"
            : "";
    if (!extension) return unavailable();

    const r2Key = String(certificate.r2Key ?? "");
    if (!r2Key || Number(certificate.size ?? 0) > 5 * 1024 * 1024)
      return unavailable();

    const original = await readR2Object(r2Key);
    const settings = await db.collection("siteSettings").doc("main").get();
    const schoolName = String(settings.get("schoolName") || "Satyam International School");
    const watermarked = await watermarkCertificate(
      original,
      mimeType,
      schoolName,
    );
    const originalName = String(
      certificate.fileName ?? `certificate${extension}`,
    );
    const mode = request.nextUrl.searchParams.get("mode");
    const inline = mode === "view" || mode === "print";
    const disposition = safeDispositionName(originalName, extension).replace(
      /^attachment/,
      inline ? "inline" : "attachment",
    );

    // Count only the explicit file-download endpoint. Do not persist requester,
    // IP address, user-agent, token or device information with download metrics.
    if (!inline) {
      await recordCertificateDownloads([
        { ref: certificateDoc.ref, session: String(certificate.session) },
      ]);
    }

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const chunkSize = 64 * 1024;
        for (
          let offset = 0;
          offset < watermarked.byteLength;
          offset += chunkSize
        ) {
          controller.enqueue(
            new Uint8Array(
              watermarked.subarray(
                offset,
                Math.min(offset + chunkSize, watermarked.byteLength),
              ),
            ),
          );
        }
        controller.close();
      },
    });
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    console.error("Protected certificate stream failed");
    return unavailable();
  }
}
