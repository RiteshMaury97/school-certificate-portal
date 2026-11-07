import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("firebase-admin/app", () => ({
  applicationDefault: vi.fn(),
  cert: vi.fn(),
  getApps: vi.fn(() => []),
  initializeApp: vi.fn(),
}));
vi.mock("firebase-admin/app-check", () => ({ getAppCheck: vi.fn() }));
vi.mock("firebase-admin/auth", () => ({ getAuth: vi.fn() }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: vi.fn() }));

import { describeAppCheckMintError } from "../src/server/firebase-admin";

describe("describeAppCheckMintError", () => {
  it("explains a disabled Firebase App Check API", () => {
    const error = new Error(
      "Firebase App Check API has not been used in project 123 before or it is disabled.",
    );
    expect(describeAppCheckMintError(error)).toContain("enable the Firebase App Check API");
  });

  it("explains an App ID that does not match the project", () => {
    expect(describeAppCheckMintError(new Error("Requested entity was not found."))).toContain(
      "NEXT_PUBLIC_FIREBASE_APP_ID",
    );
  });

  it("explains missing permission", () => {
    expect(describeAppCheckMintError(new Error("Caller does not have permission"))).toContain(
      "Firebase App Check Admin",
    );
  });

  it("includes the error code and never more than a short message", () => {
    const error = Object.assign(new Error("x".repeat(1000)), { code: "app-check/unknown" });
    const text = describeAppCheckMintError(error);
    expect(text.startsWith("[app-check/unknown] ")).toBe(true);
    expect(text.length).toBeLessThan(400);
  });
});
