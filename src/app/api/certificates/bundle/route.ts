import { PassThrough, Readable } from "node:stream";

import archiver from "archiver";
import { NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";

import { findAuthorizedCertificates } from "@/app/api/certificates/_lib/public-certificate-access";
import { recordCertificateDownloads } from "@/server/download-metrics";
import { db } from "@/server/firebase-admin";
import { readR2Object } from "@/server/r2";
import { verifyStudentAccessToken } from "@/server/security";
import { watermarkCertificate } from "@/server/watermark";
import { UPLOAD_MAX_BYTES } from "@/shared/upload-limits";

import type { Archiver } from "archiver";
import type { DocumentReference } from "firebase-admin/firestore";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const unavailable = () =>
  NextResponse.json(
    { error: "Certificate bundle unavailable." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
function safePart(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}-]+/gu, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "Certificate"
  );
}

async function appendCertificate(
  doc: QueryDocumentSnapshot,
  schoolName: string,
  archive: Archiver,
): Promise<{ ref: DocumentReference; session: string } | null> {
  const data = doc.data();
  const mime = String(data.mimeType ?? "application/pdf");
  const ext = archiveExtension(mime);
  if (!ext || Number(data.size ?? 0) > UPLOAD_MAX_BYTES || !data.r2Key) return null;
  const original = await readR2Object(String(data.r2Key));
  const watermarked = await watermarkCertificate(original, mime, schoolName);
  const pdfBytes = await archivePdf(watermarked, mime);
  const filename = `${safePart(String(data.type ?? "Certificate"))}_${safePart(String(data.session ?? "Session"))}.pdf`;
  archive.append(pdfBytes, { name: filename });
  return { ref: doc.ref, session: String(data.session ?? "") };
}

function archiveExtension(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "";
}

async function archivePdf(watermarked: Buffer, mime: string): Promise<Buffer> {
  if (mime === "application/pdf") return watermarked;
  const pdf = await PDFDocument.create();
  const image =
    mime === "image/jpeg" ? await pdf.embedJpg(watermarked) : await pdf.embedPng(watermarked);
  const page = pdf.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return Buffer.from(await pdf.save());
}

function requestedCertificateIds(request: NextRequest): string[] | null {
  const requestedIds = (request.nextUrl.searchParams.get("ids") ?? "").split(",");
  if (requestedIds.length > 20) return null;
  const ids = requestedIds.filter((id) => /^[A-Za-z0-9_-]{20,80}$/.test(id));
  return ids.length ? ids : null;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const claims = verifyStudentAccessToken(token, request);
    if (!claims) return unavailable();
    const settings = await db.collection("siteSettings").doc("main").get();
    const schoolName =
      String(settings.get("schoolName") ?? "").trim() || "Satyam International School";
    const ids = requestedCertificateIds(request);
    if (!ids) return unavailable();
    const docs = await findAuthorizedCertificates(ids, claims);
    if (!docs.length) return unavailable();
    const output = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 5 } });
    archive.on("error", () => output.destroy(new Error("Archive failed")));
    archive.pipe(output);
    const included: { ref: DocumentReference; session: string }[] = [];
    for (const doc of docs) {
      const certificate = await appendCertificate(doc, schoolName, archive);
      if (certificate) included.push(certificate);
    }
    if (!included.length) return unavailable();
    void Promise.resolve(archive.finalize())
      .then(() => recordCertificateDownloads(included))
      .catch(() => output.destroy(new Error("Archive finalization or download metrics failed")));
    const body = Readable.toWeb(output).pipeThrough(
      new TransformStream<unknown, Uint8Array>({
        transform(chunk, controller) {
          if (!(chunk instanceof Uint8Array)) throw new Error("Invalid archive data.");
          controller.enqueue(chunk);
        },
      }),
    );
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="school-certificates.zip"',
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return unavailable();
  }
}
