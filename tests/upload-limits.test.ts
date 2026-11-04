import { NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDocs } = vi.hoisted(() => ({ mockDocs: new Map<string, Record<string, unknown>>() }));
vi.mock("server-only", () => ({}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => new Date() },
}));
vi.mock("@/server/firebase-admin", () => ({
  db: {
    collection: () => ({
      doc: (id: string) => ({
        id,
        get: () =>
          Promise.resolve().then(() => {
            const value = mockDocs.get(id) ?? {};
            return { get: (key: string) => value[key] };
          }),
      }),
    }),
    runTransaction: async (
      callback: (tx: {
        get: (ref: { id: string }) => Promise<unknown>;
        set: (ref: { id: string }, data: Record<string, unknown>) => void;
      }) => Promise<unknown>,
    ) => {
      return callback({
        get: (ref) =>
          Promise.resolve().then(() => {
            const value = mockDocs.get(ref.id) ?? {};
            return { get: (key: string) => value[key] };
          }),
        set: (ref, data) => {
          mockDocs.set(ref.id, { ...(mockDocs.get(ref.id) ?? {}), ...data });
        },
      });
    },
  },
}));

import { validateCertificateFile } from "@/server/r2";
import { consumeAdminUploadQuota, rejectOversizedRequest } from "@/server/upload-policy";
import { MULTIPART_ALLOWANCE_BYTES, UPLOAD_MAX_BYTES } from "@/shared/upload-limits";

describe("upload limits", () => {
  beforeEach(() => {
    mockDocs.clear();
    vi.useRealTimers();
  });

  it("rejects an oversized Content-Length before parsing the body", () => {
    const request = new NextRequest("https://example.test", {
      headers: { "content-length": String(UPLOAD_MAX_BYTES + MULTIPART_ALLOWANCE_BYTES + 1) },
    });
    expect(rejectOversizedRequest(request)?.status).toBe(413);
  });

  it("rejects mismatched magic bytes, encrypted PDFs, and PDFs over the page limit", async () => {
    await expect(
      validateCertificateFile(Buffer.from("not a PDF"), "scan.pdf", "application/pdf"),
    ).rejects.toThrow(/supported/);
    await expect(
      validateCertificateFile(
        Buffer.from("%PDF-1.7\n/Encrypt 1 0 R"),
        "locked.pdf",
        "application/pdf",
      ),
    ).rejects.toThrow(/Encrypted/);
    const pdf = await PDFDocument.create();
    for (let page = 0; page < 11; page++) pdf.addPage();
    await expect(
      validateCertificateFile(Buffer.from(await pdf.save()), "many.pdf", "application/pdf"),
    ).rejects.toThrow(/between 1 and 10/);
  });

  it("enforces upload quotas and resets hourly and daily counters", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T10:30:00Z"));
    for (let n = 0; n < 60; n++) expect(await consumeAdminUploadQuota("admin-1", 1)).toBeNull();
    expect(await consumeAdminUploadQuota("admin-1", 1)).toMatch(/quota exceeded/i);
    vi.setSystemTime(new Date("2026-11-02T11:00:00Z"));
    expect(await consumeAdminUploadQuota("admin-1", 1)).toBeNull();
    vi.setSystemTime(new Date("2026-11-03T00:00:00Z"));
    expect(await consumeAdminUploadQuota("admin-1", 1)).toBeNull();
  });
});
