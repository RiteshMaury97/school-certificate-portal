import { describe, expect, it } from "vitest";

import {
  createSearchKey,
  createCertificateNumberHash,
  isWithinRateLimit,
  normalizeForLookup,
  signStudentAccessToken,
  verifyStudentAccessToken,
  classifySearchMatchCount,
  selectUniqueDisambiguationMatch,
  canConsumeDisambiguationAttempt,
} from "../src/server/security-primitives";
import {
  decryptStudentIdentifier,
  encryptStudentIdentifier,
  studentIdentifierHmac,
  studentIdentityMatches,
  signDisambiguationChallenge,
  verifyDisambiguationChallenge,
} from "../src/server/student-pii";

const secret = "test-only-secret-that-is-at-least-32-bytes-long";
const claims = {
  v: 1 as const,
  sid: "opaque-student-binding",
  iph: "ip-hash-abc",
  iat: 1_800_000_000,
  exp: 1_800_000_300,
  nonce: "n-1",
};

describe("student lookup normalization", () => {
  it("normalizes case, accents and repeated whitespace", () => {
    expect(normalizeForLookup("  JOSÉ   Maurya ")).toBe("jose maurya");
  });
  it("produces the same HMAC key for equivalent normalized inputs", () => {
    const a = {
      studentName: "José  Maurya",
      fatherName: "A. Maurya",
      motherName: "Sita",
      className: "Class 10",
      scholarNumber: "SCH-001",
      session: "2026-27",
    };
    const b = {
      studentName: " JOSE Maurya ",
      fatherName: "A.   Maurya",
      motherName: "Sita",
      className: " class 10 ",
      scholarNumber: "sch-001",
      session: "2026-27",
    };
    expect(createSearchKey(a, secret)).toBe(createSearchKey(b, secret));
  });
  it("does not expose canonical student details in the digest", () => {
    const key = createSearchKey(
      {
        studentName: "A Student",
        fatherName: "Parent",
        motherName: "Parent",
        className: "Class 10",
        scholarNumber: "SCH-001",
        session: "2026-27",
      },
      secret,
    );
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("student");
  });
});

describe("certificate access token", () => {
  it("verifies a correctly signed, unexpired token for the bound IP", () => {
    const token = signStudentAccessToken(claims, secret);
    expect(verifyStudentAccessToken(token, secret, "ip-hash-abc", 1_800_000_100)?.sid).toBe(
      claims.sid,
    );
  });
  it("rejects tampering, wrong IP and expired tokens", () => {
    const token = signStudentAccessToken(claims, secret);
    expect(verifyStudentAccessToken(`${token}x`, secret, "ip-hash-abc", 1_800_000_100)).toBeNull();
    expect(verifyStudentAccessToken(token, secret, "different-ip", 1_800_000_100)).toBeNull();
    expect(verifyStudentAccessToken(token, secret, "ip-hash-abc", 1_800_000_301)).toBeNull();
  });
});

describe("fixed-window rate-limit admission", () => {
  it("allows requests below the limit and blocks at the limit", () => {
    expect(isWithinRateLimit(0, 5)).toBe(true);
    expect(isWithinRateLimit(4, 5)).toBe(true);
    expect(isWithinRateLimit(5, 5)).toBe(false);
  });
  it("rejects invalid counters and limits", () => {
    expect(isWithinRateLimit(-1, 5)).toBe(false);
    expect(isWithinRateLimit(1.5, 5)).toBe(false);
    expect(isWithinRateLimit(0, 0)).toBe(false);
  });
});

describe("certificate number HMAC index", () => {
  it("normalizes case and spacing into a stable opaque lookup key", () => {
    expect(createCertificateNumberHash("  tc  2023 / 001 ", secret)).toBe(
      createCertificateNumberHash("TC 2023 / 001", secret),
    );
  });
  it("returns only a fixed-length digest and rejects empty values", () => {
    const digest = createCertificateNumberHash("TC-001", secret);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(() => createCertificateNumberHash(" ", secret)).toThrow();
  });
});

describe("duplicate student disambiguation", () => {
  const candidates = [
    {
      id: "student-a",
      dateOfBirthDisambiguationKey: "dob-a",
      admissionNumberDisambiguationKey: "adm-a",
    },
    {
      id: "student-b",
      dateOfBirthDisambiguationKey: "dob-b",
      admissionNumberDisambiguationKey: "adm-b",
    },
  ];
  it("keeps the unique search path free of an extra identifier", () => {
    expect(classifySearchMatchCount(1)).toBe("unique");
  });
  it("resolves a duplicate search only when exactly one candidate matches", () => {
    expect(classifySearchMatchCount(2)).toBe("ambiguous");
    expect(selectUniqueDisambiguationMatch(candidates, "dob-b")?.id).toBe("student-b");
  });
  it("returns no candidate for a wrong identifier or a colliding identifier", () => {
    expect(selectUniqueDisambiguationMatch(candidates, "wrong")).toBeNull();
    expect(
      selectUniqueDisambiguationMatch(
        [
          { id: "a", dateOfBirthDisambiguationKey: "same" },
          { id: "b", admissionNumberDisambiguationKey: "same" },
        ],
        "same",
      ),
    ).toBeNull();
  });
  it("caps a challenge at three attempts", () => {
    expect(isWithinRateLimit(0, 3)).toBe(true);
    expect(isWithinRateLimit(1, 3)).toBe(true);
    expect(isWithinRateLimit(2, 3)).toBe(true);
    expect(isWithinRateLimit(3, 3)).toBe(false);
    expect(canConsumeDisambiguationAttempt(2, false)).toBe(true);
    expect(canConsumeDisambiguationAttempt(3, false)).toBe(false);
    expect(canConsumeDisambiguationAttempt(0, true)).toBe(false);
  });
});

describe("encrypted student identifiers and challenge token", () => {
  it("encrypts DOB/admission values with authenticated AES-256-GCM", () => {
    process.env.STUDENT_PII_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    process.env.DISAMBIGUATION_HMAC_SECRET = secret;
    const encrypted = encryptStudentIdentifier("15-04-2010");
    expect(encrypted).not.toContain("15-04-2010");
    expect(decryptStudentIdentifier(encrypted)).toBe("2010-04-15");
    expect(() => decryptStudentIdentifier(`${encrypted.slice(0, -1)}x`)).toThrow();
    expect(studentIdentifierHmac("15-04-2010")).toBe(studentIdentifierHmac("2010-04-15"));
    expect(
      studentIdentityMatches(
        { dateOfBirthDisambiguationKey: studentIdentifierHmac("2010-04-15") },
        studentIdentifierHmac("2010-04-15"),
        studentIdentifierHmac("ADM-2"),
      ),
    ).toBe(true);
    expect(
      studentIdentityMatches(
        {
          dateOfBirthDisambiguationKey: studentIdentifierHmac("2010-04-15"),
          admissionNumberDisambiguationKey: studentIdentifierHmac("ADM-1"),
        },
        studentIdentifierHmac("2010-04-15"),
        studentIdentifierHmac("ADM-2"),
      ),
    ).toBe(false);
  });
  it("signs a two-minute challenge bound to the requesting IP", () => {
    const challengeSecret = "another-test-secret-with-at-least-32-bytes";
    const claims = {
      v: 1 as const,
      sk: "a".repeat(64),
      iph: "ip-one",
      iat: 1_800_000_000,
      exp: 1_800_000_120,
      nonce: "b".repeat(32),
    };
    const token = signDisambiguationChallenge(claims, challengeSecret);
    expect(verifyDisambiguationChallenge(token, challengeSecret, "ip-one", 1_800_000_100)).toEqual(
      claims,
    );
    expect(
      verifyDisambiguationChallenge(token, challengeSecret, "ip-two", 1_800_000_100),
    ).toBeNull();
    expect(
      verifyDisambiguationChallenge(token, challengeSecret, "ip-one", 1_800_000_121),
    ).toBeNull();
  });
});
