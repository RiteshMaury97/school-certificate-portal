export type CertificateLifecycleStatus =
  "pending" | "published" | "superseded" | "revoked" | "rejected";
export type PublicVerificationOutcome =
  | { valid: true; status: "published" }
  | {
      valid: false;
      status: "superseded";
      message: string;
      newCertificateNumber: string;
    }
  | { valid: false; status: "revoked"; message: string }
  | { valid: false; status: "not-found" };

export function isPubliclyDownloadableStatus(status: unknown): status is "published" {
  return status === "published";
}

export function publicVerificationOutcome(
  status: unknown,
  newCertificateNumber = "",
): PublicVerificationOutcome {
  if (status === "published") return { valid: true, status: "published" };
  if (status === "superseded" && newCertificateNumber)
    return {
      valid: false,
      status: "superseded",
      message:
        "This certificate has been replaced by a newer version. Please contact the school for the current one.",
      newCertificateNumber,
    };
  if (status === "revoked")
    return {
      valid: false,
      status: "revoked",
      message: "This certificate is no longer valid. Please contact the school.",
    };
  return { valid: false, status: "not-found" };
}

export function canReplacePublishedCertificate(status: unknown): boolean {
  return status === "published";
}

export type DuplicateFileMatch = { studentId: unknown; type: unknown };
export type DuplicateFileDecision = "none" | "block-same-student-type" | "warn-cross-record";
export function duplicateFileDecision(
  matches: readonly DuplicateFileMatch[],
  studentId: string,
  certificateType: string,
): DuplicateFileDecision {
  if (matches.some((match) => match.studentId === studentId && match.type === certificateType))
    return "block-same-student-type";
  return matches.length ? "warn-cross-record" : "none";
}
