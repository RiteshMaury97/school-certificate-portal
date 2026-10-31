import { NextRequest, NextResponse } from "next/server";
import archiver from "archiver";
import { PDFDocument } from "pdf-lib";
import type { DocumentReference } from "firebase-admin/firestore";
import { PassThrough, Readable } from "node:stream";
import { db } from "@/server/firebase-admin";
import { readR2Object } from "@/server/r2";
import { watermarkCertificate } from "@/server/watermark";
import {
  studentAccessTokenOwnsStudent,
  verifyStudentAccessToken,
} from "@/server/security";
import { recordCertificateDownloads } from "@/server/download-metrics";

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
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token") ?? "";
    const claims = verifyStudentAccessToken(token, request);
    if (!claims) return unavailable();
    const settings = await db.collection("siteSettings").doc("main").get();
    const schoolName = String(settings.get("schoolName") || "Satyam International School");
    const requestedIds = (request.nextUrl.searchParams.get("ids") ?? "").split(
      ",",
    );
    if (!requestedIds.length || requestedIds.length > 20) return unavailable();
    const ids = requestedIds.filter((id) => /^[A-Za-z0-9_-]{20,80}$/.test(id));
    if (!ids.length) return unavailable();
    const docs = [];
    const studentStates = new Map<string, boolean>();
    for (const id of ids) {
      const found = await db
        .collection("certificates")
        .where("publicId", "==", id)
        .limit(1)
        .get();
      if (found.empty) continue;
      const doc = found.docs[0]!;
      const d = doc.data();
      const studentId = String(d.studentId ?? "");
      if (!studentId || !studentAccessTokenOwnsStudent(claims, studentId))
        continue;
      let visible = studentStates.get(studentId);
      if (visible === undefined) {
        const student = await db.collection("students").doc(studentId).get();
        const visibleNow =
          student.exists === true && student.get("erasurePending") !== true;
        visible = visibleNow;
        studentStates.set(studentId, visibleNow);
      }
      if (d.status === "published" && d.published !== false && visible === true)
        docs.push(doc);
    }
    if (!docs.length) return unavailable();
    const output = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 5 } });
    archive.on("error", () => output.destroy(new Error("Archive failed")));
    archive.pipe(output);
    const included: Array<{ ref: DocumentReference; session: string }> = [];
    for (const doc of docs) {
      const data = doc.data();
      const mime = String(data.mimeType ?? "application/pdf");
      const ext =
        mime === "application/pdf"
          ? "pdf"
          : mime === "image/jpeg"
            ? "jpg"
            : mime === "image/png"
              ? "png"
              : "";
      if (!ext || Number(data.size ?? 0) > 5 * 1024 * 1024 || !data.r2Key)
        continue;
      const original = await readR2Object(String(data.r2Key));
      const watermarked = await watermarkCertificate(
        original,
        mime,
        schoolName,
      );
      let pdfBytes = watermarked;
      if (mime !== "application/pdf") {
        const pdf = await PDFDocument.create();
        const image =
          mime === "image/jpeg"
            ? await pdf.embedJpg(watermarked)
            : await pdf.embedPng(watermarked);
        const page = pdf.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
        pdfBytes = Buffer.from(await pdf.save());
      }
      const filename = `${safePart(String(data.type ?? "Certificate"))}_${safePart(String(data.session ?? "Session"))}.pdf`;
      archive.append(pdfBytes, { name: filename });
      included.push({ ref: doc.ref, session: String(data.session ?? "") });
    }
    if (!included.length) return unavailable();
    void Promise.resolve(archive.finalize())
      .then(() => recordCertificateDownloads(included))
      .catch(() =>
        output.destroy(
          new Error("Archive finalization or download metrics failed"),
        ),
      );
    const body = Readable.toWeb(output) as ReadableStream<Uint8Array>;
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
