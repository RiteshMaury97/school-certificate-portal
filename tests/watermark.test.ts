// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";
import { watermarkCertificate } from "../src/server/watermark";

describe("watermarked delivery copies", () => {
  let pdfBytes: Buffer;
  let imageBytes: Buffer;
  beforeAll(async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([300, 400]);
    pdfBytes = Buffer.from(await pdf.save());
    imageBytes = await sharp({
      create: { width: 320, height: 240, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer();
  });
  it("adds a PDF overlay without changing page count", async () => {
    const output = await watermarkCertificate(
      pdfBytes,
      "application/pdf",
      "Test School",
    );
    const reopened = await PDFDocument.load(output);
    expect(output.equals(pdfBytes)).toBe(false);
    expect(reopened.getPageCount()).toBe(1);
  });
  it("adds an image watermark while returning a valid PNG", async () => {
    const output = await watermarkCertificate(
      imageBytes,
      "image/png",
      "Test School",
    );
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(320);
  });
  it("rejects unsupported media types", async () => {
    await expect(
      watermarkCertificate(Buffer.from("bad"), "text/plain", "Test School"),
    ).rejects.toThrow("Unsupported certificate media type");
  });
});
