import { describe, expect, it } from "vitest";

import {
  canReplacePublishedCertificate,
  duplicateFileDecision,
  isPubliclyDownloadableStatus,
  publicVerificationOutcome,
} from "../src/shared/certificate-lifecycle";

describe("certificate lifecycle", () => {
  it("exposes only published certificates to public download flows", () => {
    expect(isPubliclyDownloadableStatus("published")).toBe(true);
    for (const status of ["pending", "superseded", "revoked", "rejected"])
      expect(isPubliclyDownloadableStatus(status)).toBe(false);
  });
  it("returns only the newer certificate number for superseded verification", () => {
    expect(publicVerificationOutcome("superseded", "CERT-NEW")).toEqual({
      valid: false,
      status: "superseded",
      message:
        "This certificate has been replaced by a newer version. Please contact the school for the current one.",
      newCertificateNumber: "CERT-NEW",
    });
    expect(publicVerificationOutcome("superseded", "").status).toBe("not-found");
  });
  it("does not disclose internal revocation reasons", () => {
    expect(publicVerificationOutcome("revoked")).toEqual({
      valid: false,
      status: "revoked",
      message: "This certificate is no longer valid. Please contact the school.",
    });
  });
  it("blocks same-student/type duplicate bytes and warns on cross-record matches", () => {
    expect(duplicateFileDecision([{ studentId: "s1", type: "Marksheet" }], "s1", "Marksheet")).toBe(
      "block-same-student-type",
    );
    expect(duplicateFileDecision([{ studentId: "s2", type: "Marksheet" }], "s1", "Marksheet")).toBe(
      "warn-cross-record",
    );
    expect(duplicateFileDecision([], "s1", "Marksheet")).toBe("none");
  });
  it("allows replacement only from published state", () => {
    expect(canReplacePublishedCertificate("published")).toBe(true);
    expect(canReplacePublishedCertificate("pending")).toBe(false);
    expect(canReplacePublishedCertificate("superseded")).toBe(false);
    expect(canReplacePublishedCertificate("revoked")).toBe(false);
    expect(canReplacePublishedCertificate("rejected")).toBe(false);
  });
});
