import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as exportBreaches } from "../src/app/api/admin/breaches/export/route";
import { POST as reportSuspected } from "../src/app/api/admin/breaches/report/route";
import { PATCH, POST } from "../src/app/api/admin/breaches/route";
import {
  breachClosureError,
  breachFieldsSchema,
  canTransitionBreach,
  type BreachFields,
} from "../src/shared/breach-schema";

const state = vi.hoisted(() => ({
  role: "superadmin",
  currentExists: true,
  existing: {
    title: "Incident",
    summary: "A sufficiently detailed incident summary.",
    discoveredAt: new Date("2026-11-01T09:00:00.000Z"),
    howDiscovered: "Staff member saw the warning.",
    cause: "other",
    dataCategories: ["student-names"],
    affectedPrincipalsEstimate: 5,
    involvesMinors: true,
    severity: "high",
    incidentLead: "admin-1",
    status: "notified",
    boardNotifiedAt: new Date("2026-11-01T10:00:00.000Z"),
    principalsNotifiedAt: new Date("2026-11-01T11:00:00.000Z"),
    rootCause: "A missing access check exposed a restricted resource.",
    correctiveActions: "Access rules were repaired and reviewed.",
    lessonsLearned: "Add an access review to each release.",
  },
  add: vi.fn(() => Promise.resolve({ id: "breach-1", collection: () => ({ add: state.add }) })),
  set: vi.fn(() => Promise.resolve()),
  audit: vi.fn(() => Promise.resolve()),
  mail: vi.fn((input: { to: string[]; subject: string; text: string }) => {
    return Promise.resolve(input.text);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => new Date("2026-11-02T00:00:00.000Z") },
  Timestamp: class Timestamp {
    toDate() {
      return new Date();
    }
  },
}));
vi.mock("@/server/firebase-admin", () => ({
  db: {
    collection: (name: string) => ({
      add: name === "breaches" ? state.add : vi.fn(),
      doc: () => ({
        get: () =>
          Promise.resolve({
            exists: name === "breaches" ? state.currentExists : true,
            data: () => state.existing,
            get: () => null,
          }),
        set: state.set,
        collection: () => ({ add: state.add }),
      }),
      where: () => ({
        where: () => ({
          get: () => Promise.resolve({ docs: [{ get: () => "security@school.example" }] }),
        }),
      }),
    }),
  },
}));
vi.mock("@/server/security", () => ({
  apiError: (error: unknown) =>
    Response.json({ error: error instanceof Error ? error.message : "error" }, { status: 403 }),
  requireRoles: (_request: unknown, roles: string[]) => {
    if (!roles.includes(state.role)) throw new Error("FORBIDDEN");
    return Promise.resolve({ uid: "admin-1", email: "security@school.example", role: state.role });
  },
  writeAuditLog: state.audit,
}));
vi.mock("@/server/mailer", () => ({ sendMail: state.mail }));

function request(path: string, method: "POST" | "PATCH", body: Record<string, unknown>) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}

const validIncident = {
  title: "Unauthorized student record view",
  summary: "A protected student page was exposed to an unauthorized user.",
  discoveredAt: "2026-11-01T09:00:00.000Z",
  howDiscovered: "A monitoring alert was reviewed by the school team.",
  cause: "unauthorized-access",
  dataCategories: ["student-names"],
  systemsAffected: "Student portal",
  affectedPrincipalsEstimate: 5,
  involvesMinors: true,
  severity: "high",
  containmentActions: "Restricted access was disabled.",
  likelyConsequences: "Records may have been viewed.",
  incidentLead: "admin-1",
  status: "reported",
};
const closureDetails: Partial<BreachFields> = {
  rootCause: "A missing access check exposed a restricted resource.",
  correctiveActions: "Access rules were repaired and reviewed.",
  lessonsLearned: "Add an access review to each release.",
  dataCategories: ["student-names"],
  involvesMinors: true,
};

describe("personal data breach records", () => {
  beforeEach(() => {
    state.role = "superadmin";
    state.currentExists = true;
    state.existing.status = "notified";
    state.existing.rootCause = "A missing access check exposed a restricted resource.";
    state.add.mockClear();
    state.set.mockClear();
    state.audit.mockClear();
    state.mail.mockClear();
  });
  afterEach(() => vi.clearAllMocks());

  it("validates required schema fields and bounds", () => {
    expect(breachFieldsSchema.safeParse(validIncident).success).toBe(true);
    expect(breachFieldsSchema.safeParse({ ...validIncident, summary: "short" }).success).toBe(
      false,
    );
    expect(
      breachFieldsSchema.safeParse({ ...validIncident, dataCategories: ["unknown"] }).success,
    ).toBe(false);
    expect(
      breachFieldsSchema.safeParse({
        ...validIncident,
        summary: "Student contact was emailed to sample@example.test.",
      }).success,
    ).toBe(false);
  });

  it("allows only sequential status transitions", () => {
    expect(canTransitionBreach("reported", "investigating")).toBe(true);
    expect(canTransitionBreach("reported", "contained")).toBe(false);
    expect(canTransitionBreach("closed", "reported")).toBe(false);
  });

  it("requires closure documentation and student notifications or a reason", () => {
    expect(breachClosureError({ ...closureDetails, rootCause: "" })).toContain("Root cause");
    expect(breachClosureError(closureDetails)).toContain("notification dates");
    expect(
      breachClosureError({
        ...closureDetails,
        notificationExceptionReason: "No student records left the protected environment.",
      }),
    ).toBeNull();
  });

  it("allows any signed-in admin to report and emails the superadmins", async () => {
    state.role = "uploader";
    const response = await reportSuspected(
      request("/api/admin/breaches/report", "POST", {
        title: "Possible account exposure",
        summary: "An unusual account access alert needs investigation.",
        discoveredAt: "2026-11-01T09:00:00.000Z",
        howDiscovered: "Alert from the monitoring service.",
      }),
    );
    expect(response.status).toBe(201);
    expect(state.mail).toHaveBeenCalledOnce();
    expect(JSON.stringify(state.mail.mock.calls[0]?.[0])).not.toContain("unusual account access alert");
    expect(state.audit).toHaveBeenCalledTimes(2);
  });

  it("rejects non-superadmin full creates and accepts superadmin creates", async () => {
    state.role = "approver";
    const denied = await POST(request("/api/admin/breaches", "POST", validIncident));
    expect(denied.status).toBe(403);
    state.role = "superadmin";
    const created = await POST(request("/api/admin/breaches", "POST", validIncident));
    expect(created.status).toBe(201);
    expect(state.add).toHaveBeenCalled();
    expect(state.mail).toHaveBeenCalledOnce();
    expect(JSON.stringify(state.mail.mock.calls[0]?.[0])).not.toContain(validIncident.summary);
    expect(state.audit).toHaveBeenCalledTimes(2);
  });

  it("restricts incident exports to superadmins", async () => {
    state.role = "admin";
    const response = await exportBreaches(
      new NextRequest("http://localhost/api/admin/breaches/export?format=csv"),
    );
    expect(response.status).toBe(403);
  });

  it("rejects skipped transitions and incomplete closure", async () => {
    state.existing.status = "reported";
    const skipped = await PATCH(
      request("/api/admin/breaches", "PATCH", { id: "breach-1", status: "closed" }),
    );
    expect(skipped.status).toBe(409);
    state.existing.status = "notified";
    state.existing.rootCause = "";
    const incomplete = await PATCH(
      request("/api/admin/breaches", "PATCH", { id: "breach-1", status: "closed" }),
    );
    expect(incomplete.status).toBe(400);
    expect(state.set).not.toHaveBeenCalled();
  });

  it("appends immutable update entries for changes", async () => {
    state.existing.status = "reported";
    const response = await PATCH(
      request("/api/admin/breaches", "PATCH", { id: "breach-1", status: "investigating" }),
    );
    expect(response.status).toBe(200);
    expect(state.add).toHaveBeenCalled();
    expect(state.set).toHaveBeenCalledOnce();
    expect(state.audit).toHaveBeenCalledOnce();
  });

  it("migrates old breachLogs documents into the compatible breaches register on edit", async () => {
    state.currentExists = false;
    const response = await PATCH(
      request("/api/admin/breaches", "PATCH", {
        id: "breach-1",
        summary: "Updated summary for the existing legacy incident.",
      }),
    );
    expect(response.status).toBe(200);
    expect(state.set).toHaveBeenCalledTimes(2);
    expect(state.audit).toHaveBeenCalledOnce();
  });
});
