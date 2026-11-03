import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  records: [] as { id: string; value: Record<string, unknown> }[],
  claims: new Set<string>(),
  mail: vi.fn((input: { to: string[]; subject: string; text: string }) => {
    return Promise.resolve(input.text);
  }),
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => new Date("2026-11-04T04:00:00.000Z") },
  Timestamp: class Timestamp {
    toDate() {
      return new Date("2026-11-01T00:00:00.000Z");
    }
  },
}));
vi.mock("@/server/firebase-admin", () => ({
  db: {
    collection: (name: string) => {
      if (name === "breaches")
        return {
          get: () =>
            Promise.resolve({
              docs: state.records.map((record) => ({ id: record.id, data: () => record.value })),
            }),
        };
      if (name === "admins")
        return {
          where: () => ({
            where: () => ({
              limit: () => ({
                get: () => Promise.resolve({ docs: [{ get: () => "security@school.example" }] }),
              }),
            }),
          }),
        };
      return {
        doc: (id: string) => ({
          get: () => Promise.resolve({ exists: state.claims.has(id) }),
          set: () => {
            state.claims.add(id);
            return Promise.resolve();
          },
          delete: () => {
            state.claims.delete(id);
            return Promise.resolve();
          },
        }),
      };
    },
    runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) =>
      callback({
        get: (reference: { get: () => Promise<{ exists: boolean }> }) => reference.get(),
        set: (reference: { set: () => Promise<void> }) => reference.set(),
      }),
  },
}));
vi.mock("@/server/mailer", () => ({ sendMail: state.mail }));

import { GET } from "../src/app/api/cron/breach-reminders/route";

describe("daily breach reminder cron", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "0123456789abcdef0123456789abcdef";
    state.records = [];
    state.claims.clear();
    state.mail.mockClear();
    vi.useRealTimers();
  });

  it("rejects unauthorized calls", async () => {
    const response = await GET(new NextRequest("http://localhost/api/cron/breach-reminders"));
    expect(response.status).toBe(401);
  });

  it("sends every reached milestone and the 30-hour reminder once across daily runs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T18:00:00.000Z"));
    state.records = [
      {
        id: "incident-1",
        value: { title: "Portal incident", status: "investigating", discoveredAt: new Date("2026-11-01T00:00:00.000Z") },
      },
    ];
    const request = () =>
      new NextRequest("http://localhost/api/cron/breach-reminders", {
        headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` },
      });

    const first = await GET(request());
    const second = await GET(request());
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(state.mail).toHaveBeenCalledTimes(4);
    const messages = state.mail.mock.calls.map((call) => call[0]);
    expect(messages.map((message) => message.subject)).toEqual([
      "Breach register reminder: 24 hours",
      "Breach register reminder: 48 hours",
      "Breach register reminder: 66 hours",
      "Breach register reminder: due within 30 hours",
    ]);
  });
});
