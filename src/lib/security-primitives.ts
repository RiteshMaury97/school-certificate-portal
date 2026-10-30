import { createHmac, timingSafeEqual } from "node:crypto";

export type StudentAccessClaims = {
  v: 1;
  sid: string;
  iph: string;
  iat: number;
  exp: number;
  nonce: string;
};

export function normalizeForLookup(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function createSearchKey(
  input: {
    studentName: string;
    fatherName: string;
    motherName: string;
    session: string;
  },
  secret: string,
): string {
  if (Buffer.byteLength(secret, "utf8") < 32)
    throw new Error("Search HMAC secret must be at least 32 bytes");
  const canonical = [
    normalizeForLookup(input.studentName),
    normalizeForLookup(input.fatherName),
    normalizeForLookup(input.motherName),
    input.session.trim(),
  ].join("|");
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

export function createCertificateNumberHash(
  value: string,
  secret: string,
): string {
  if (Buffer.byteLength(secret, "utf8") < 32)
    throw new Error("Certificate number HMAC secret must be at least 32 bytes");
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  if (!normalized || normalized.length > 80)
    throw new Error("Invalid certificate number");
  return createHmac("sha256", secret).update(normalized, "utf8").digest("hex");
}

export function bindStudentId(studentId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`student:${studentId}`, "utf8")
    .digest("hex");
}

export function signStudentAccessToken(
  claims: StudentAccessClaims,
  secret: string,
): string {
  if (Buffer.byteLength(secret, "utf8") < 32)
    throw new Error("Access token secret must be at least 32 bytes");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyStudentAccessToken(
  token: string,
  secret: string,
  expectedIpHash: string,
  now = Math.floor(Date.now() / 1000),
): StudentAccessClaims | null {
  try {
    if (Buffer.byteLength(secret, "utf8") < 32 || token.length > 2048)
      return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts as [string, string];
    const expected = createHmac("sha256", secret).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as StudentAccessClaims;
    if (
      claims.v !== 1 ||
      typeof claims.sid !== "string" ||
      !claims.sid ||
      typeof claims.iph !== "string" ||
      claims.iph !== expectedIpHash ||
      typeof claims.exp !== "number" ||
      claims.exp <= now ||
      typeof claims.iat !== "number" ||
      claims.iat > now + 30 ||
      claims.exp - claims.iat > 5 * 60 ||
      typeof claims.nonce !== "string" ||
      !claims.nonce
    )
      return null;
    return claims;
  } catch {
    return null;
  }
}

/** Fixed-window admission predicate shared by the Firestore transaction and unit tests. */
export function isWithinRateLimit(
  currentCount: number,
  limit: number,
): boolean {
  return (
    Number.isFinite(currentCount) &&
    Number.isInteger(currentCount) &&
    Number.isFinite(limit) &&
    Number.isInteger(limit) &&
    limit > 0 &&
    currentCount >= 0 &&
    currentCount < limit
  );
}

export function classifySearchMatchCount(
  count: number,
): "none" | "unique" | "ambiguous" {
  if (!Number.isInteger(count) || count < 0)
    throw new Error("Invalid match count");
  return count === 0 ? "none" : count === 1 ? "unique" : "ambiguous";
}

export function selectUniqueDisambiguationMatch<
  T extends {
    dateOfBirthDisambiguationKey?: unknown;
    admissionNumberDisambiguationKey?: unknown;
  },
>(candidates: readonly T[], answerHash: string): T | null {
  const matches = candidates.filter(
    (candidate) =>
      candidate.dateOfBirthDisambiguationKey === answerHash ||
      candidate.admissionNumberDisambiguationKey === answerHash,
  );
  return matches.length === 1 ? matches[0]! : null;
}

export function canConsumeDisambiguationAttempt(
  currentCount: number,
  completed: boolean,
): boolean {
  return !completed && isWithinRateLimit(currentCount, 3);
}
