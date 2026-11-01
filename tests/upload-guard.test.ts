import { beforeEach, describe, expect, it, vi } from "vitest";

const docs = new Map<string, Record<string, unknown>>();
vi.mock("@/server/firebase-admin", () => ({
  db: {
    collection: () => ({ doc: (id: string) => ({ id }) }),
    runTransaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        get: (ref: { id: string }) => ({ data: () => docs.get(ref.id) ?? {} }),
        set: (ref: { id: string }, value: Record<string, unknown>) => {
          docs.set(ref.id, { ...docs.get(ref.id), ...value });
        },
      }),
  },
}));

import { rejectOversizedRequest, reserveUploadQuota } from "@/server/upload-guard";

describe("upload guard", () => {
  beforeEach(() => {
    docs.clear();
    vi.useRealTimers();
  });
  it("rejects an oversized declared request before parsing the body", () => {
    const req = new Request("https://example.test", {
      headers: { "content-length": String(5 * 1024 * 1024) },
    });
    expect(rejectOversizedRequest(req)?.status).toBe(413);
  });
  it("enforces quota and resets hourly and daily counters at boundaries", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T23:59:00Z"));
    for (let i = 0; i < 60; i++) await reserveUploadQuota("admin-a", 1);
    await expect(reserveUploadQuota("admin-a", 1)).rejects.toThrow("UPLOAD_QUOTA:");
    vi.setSystemTime(new Date("2026-01-02T00:00:00Z"));
    await expect(reserveUploadQuota("admin-a", 1)).resolves.toBeUndefined();
    vi.setSystemTime(new Date("2026-01-02T01:00:00Z"));
    await expect(reserveUploadQuota("admin-a", 1)).resolves.toBeUndefined();
  });
});
