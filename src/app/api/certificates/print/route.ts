import { NextResponse } from "next/server";

import { findAuthorizedCertificates } from "@/app/api/certificates/_lib/public-certificate-access";
import { db } from "@/server/firebase-admin";
import { readR2Object } from "@/server/r2";
import { verifyStudentAccessToken } from "@/server/security";
import { watermarkCertificate } from "@/server/watermark";
import { UPLOAD_MAX_BYTES } from "@/shared/upload-limits";

import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const unavailable = () =>
  new NextResponse("Certificate print view unavailable.", {
    status: 404,
    headers: { "Cache-Control": "no-store", "Content-Type": "text/plain" },
  });

function esc(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character,
  );
}

async function certificatePage(
  doc: QueryDocumentSnapshot,
  schoolName: string,
): Promise<string | null> {
  const data = doc.data();
  const mime = String(data.mimeType ?? "application/pdf");
  if (
    !["application/pdf", "image/jpeg", "image/png"].includes(mime) ||
    !data.r2Key ||
    Number(data.size ?? 0) > UPLOAD_MAX_BYTES
  )
    return null;
  const bytes = await watermarkCertificate(
    await readR2Object(String(data.r2Key)),
    mime,
    schoolName,
  );
  const dataUrl = `data:${mime};base64,${bytes.toString("base64")}`;
  const type = esc(String(data.type ?? "Certificate"));
  const content =
    mime === "application/pdf"
      ? `<iframe title="${type}" src="${dataUrl}"></iframe>`
      : `<img alt="${type}" src="${dataUrl}">`;
  return `<section class="sheet"><h1>${esc(schoolName)}</h1><p>${type} · ${esc(String(data.session ?? ""))}</p>${content}</section>`;
}

async function printPages(
  docs: QueryDocumentSnapshot[],
  schoolName: string,
): Promise<string[]> {
  const pages: string[] = [];
  for (const doc of docs) {
    const page = await certificatePage(doc, schoolName);
    if (page) pages.push(page);
  }
  return pages;
}

function printDocument(schoolName: string, nonce: string, pages: string[]): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Certificates - ${esc(schoolName)}</title><style nonce="${nonce}">body{font-family:Arial,sans-serif;margin:0;color:#12151c}.toolbar{padding:16px;text-align:center;background:#f6f3ec;border-bottom:1px solid #ddd6c6;position:sticky;top:0}.toolbar button{min-height:44px;padding:0 22px;border:0;border-radius:10px;background:#17233f;color:#fbf7ee;font:inherit;font-weight:700;cursor:pointer}.toolbar button:focus-visible{outline:3px solid #2447b8;outline-offset:3px}.sheet{padding:24px;min-height:90vh;break-after:page;text-align:center}.sheet iframe{width:100%;height:80vh;border:0}.sheet img{max-width:100%;max-height:78vh;object-fit:contain}@media print{.toolbar{display:none}.sheet{padding:0;min-height:100vh}.sheet iframe{height:95vh}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}</style></head><body><div class="toolbar"><button id="print-button">Print all certificates</button></div>${pages.join("")}<script nonce="${nonce}">document.getElementById("print-button")?.addEventListener("click",()=>window.print());</script></body></html>`;
}

export async function GET(request: NextRequest) {
  try {
    const claims = verifyStudentAccessToken(
      request.nextUrl.searchParams.get("token") ?? "",
      request,
    );
    if (!claims) return unavailable();
    const requestedIds = (request.nextUrl.searchParams.get("ids") ?? "").split(",");
    if (requestedIds.length > 20) return unavailable();
    const ids = requestedIds.filter((id) => /^[A-Za-z0-9_-]{20,80}$/.test(id));
    if (!ids.length) return unavailable();
    const settings = await db.collection("siteSettings").doc("main").get();
    const schoolName =
      String(settings.get("schoolName") ?? "").trim() || "Satyam International School";
    const docs = await findAuthorizedCertificates(ids, claims);
    const pages = await printPages(docs, schoolName);
    if (!pages.length) return unavailable();
    const nonce = request.headers.get("x-nonce") ?? "";
    return new NextResponse(printDocument(schoolName, nonce, pages), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": `default-src 'none'; img-src data:; frame-src data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; sandbox allow-scripts allow-modals`,
        "X-Robots-Tag": "noindex, nofollow, noarchive",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return unavailable();
  }
}
