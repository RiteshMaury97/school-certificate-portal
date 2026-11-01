import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, degrees, rgb } from "pdf-lib";
import sharp from "sharp";

const regularFontPromise = readFile(
  join(process.cwd(), "public/fonts/NotoSansDevanagari-Regular.ttf"),
);
const boldFontPromise = readFile(join(process.cwd(), "public/fonts/NotoSansDevanagari-Bold.ttf"));
function stampTime(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${parts} IST`;
}
function xml(value: string): string {
  return value.replace(
    /[&<>\"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '\"': "&quot;",
        "'": "&apos;",
      })[char] ?? char,
  );
}
async function watermarkPdf(input: Buffer, watermark: string, footer: string): Promise<Buffer> {
  const pdf = await PDFDocument.load(input, { updateMetadata: false });
  if (pdf.getPageCount() > 100) throw new Error("Certificate PDF contains too many pages");
  pdf.registerFontkit(fontkit);
  const [regularBytes, boldBytes] = await Promise.all([regularFontPromise, boldFontPromise]);
  const font = await pdf.embedFont(boldBytes, { subset: true });
  const footerFont = await pdf.embedFont(regularBytes, { subset: true });
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.max(12, Math.min(23, width / 26));
    const textWidth = font.widthOfTextAtSize(watermark, size);
    const repeats = Math.max(1, Math.ceil((width + height) / Math.max(textWidth + 80, 220)));
    for (let i = -1; i < repeats; i++) {
      page.drawText(watermark, {
        x: i * (textWidth + 90) - height * 0.2,
        y: height * 0.48,
        size,
        font,
        color: rgb(0.071, 0.082, 0.11),
        opacity: 0.13,
        rotate: degrees(-28),
      });
    }
    page.drawText(footer, {
      x: 18,
      y: 12,
      size: 7,
      font: footerFont,
      color: rgb(0.071, 0.082, 0.11),
      opacity: 0.72,
      maxWidth: Math.max(100, width - 36),
    });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: true }));
}

async function watermarkImage(input: Buffer, watermark: string, footer: string): Promise<Buffer> {
  const image = sharp(input, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  });
  const meta = await image.metadata();
  const width = meta.width;
  const height = meta.height;
  if (!width || !height || width > 12000 || height > 12000)
    throw new Error("Unsupported image dimensions");
  const [regularBytes, boldBytes] = await Promise.all([regularFontPromise, boldFontPromise]);
  const fontSize = Math.max(14, Math.min(32, Math.round(width / 28)));
  const fontFace = `@font-face{font-family:NotoSchool;src:url(data:font/ttf;base64,${boldBytes.toString("base64")}) format('truetype');font-weight:700}@font-face{font-family:NotoSchool;src:url(data:font/ttf;base64,${regularBytes.toString("base64")}) format('truetype');font-weight:400}`;
  const footerSize = Math.max(6, Math.min(17, Math.round(width / 75)));
  const footerBand = Math.min(34, Math.max(18, Math.round(height * 0.06)));
  const widthText = String(width);
  const heightText = String(height);
  const fontSizeText = String(fontSize);
  const footerSizeText = String(footerSize);
  const footerBandText = String(footerBand);
  const watermarkX = String(width / 2);
  const watermarkY = String(height / 2);
  const footerTop = String(Math.max(0, height - footerBand));
  const footerTextY = String(height - Math.max(5, Math.round(footerBand * 0.28)));
  const svg = `<svg width="${widthText}" height="${heightText}" xmlns="http://www.w3.org/2000/svg"><style>${fontFace}</style><g transform="translate(${watermarkX} ${watermarkY}) rotate(-28)"><text text-anchor="middle" dominant-baseline="middle" font-family="NotoSchool" font-size="${fontSizeText}" font-weight="700" fill="#12151c" fill-opacity="0.14">${xml(watermark)}</text></g><rect x="0" y="${footerTop}" width="${widthText}" height="${footerBandText}" fill="#ffffff" fill-opacity="0.42"/><text x="14" y="${footerTextY}" font-family="NotoSchool" font-size="${footerSizeText}" font-weight="400" fill="#12151c" fill-opacity="0.78">${xml(footer)}</text></svg>`;
  return image.composite([{ input: Buffer.from(svg), blend: "over" }]).toBuffer();
}

export async function watermarkCertificate(
  input: Buffer,
  mimeType: string,
  schoolName: string,
): Promise<Buffer> {
  const watermark = `Verified copy - ${schoolName.trim() || "Satyam International School"}`;
  const footer = `Downloaded on ${stampTime()}`;
  if (mimeType === "application/pdf") return watermarkPdf(input, watermark, footer);
  if (mimeType === "image/jpeg" || mimeType === "image/png")
    return watermarkImage(input, watermark, footer);
  throw new Error("Unsupported certificate media type");
}
