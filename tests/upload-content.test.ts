import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { detectFile, validatePdf } from "@/server/r2";

describe("certificate content validation", () => {
  it("rejects incorrect magic bytes", () => {
    expect(() => detectFile(Buffer.from("not a PDF"))).toThrow("not a supported");
  });
  it("rejects encrypted or malformed PDFs", async () => {
    const pdf = Buffer.from(
      await (await PDFDocument.create()).save({ useObjectStreams: false }),
    ).toString("latin1");
    const encrypted = pdf.replace("trailer\n<<", "trailer\n<< /Encrypt 9 0 R");
    await expect(validatePdf(Buffer.from(encrypted, "latin1"))).rejects.toThrow("encrypted");
  });
  it("parses page count and rejects PDFs over the shared limit", async () => {
    const document = await PDFDocument.create();
    for (let i = 0; i < 11; i++) document.addPage();
    await expect(validatePdf(Buffer.from(await document.save()))).rejects.toThrow("10 pages");
  });
});
