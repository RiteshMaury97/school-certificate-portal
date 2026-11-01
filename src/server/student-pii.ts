import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

function secret(name: string): Buffer {
  const raw = process.env[name];
  if (!raw) throw new Error(`${name} is required`);
  const value =
    name === "STUDENT_PII_ENCRYPTION_KEY" ? Buffer.from(raw, "base64") : Buffer.from(raw, "utf8");
  if (name === "STUDENT_PII_ENCRYPTION_KEY" && value.length !== 32)
    throw new Error(`${name} must represent exactly 32 bytes`);
  if (name !== "STUDENT_PII_ENCRYPTION_KEY" && value.length < 32)
    throw new Error(`${name} must be at least 32 bytes`);
  return value;
}

export function normalizeStudentIdentifier(value: string): string {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
  const dmy = /^(\d{2})[-/.](\d{2})[-/.](\d{4})$/.exec(normalized);
  if (dmy) return `${dmy[3] ?? ""}-${dmy[2] ?? ""}-${dmy[1] ?? ""}`;
  return normalized;
}

export function studentIdentifierHmac(value: string): string {
  const normalized = normalizeStudentIdentifier(value);
  if (!normalized || normalized.length > 100) throw new Error("Invalid student identifier");
  return createHmac("sha256", secret("DISAMBIGUATION_HMAC_SECRET"))
    .update(normalized, "utf8")
    .digest("hex");
}

export function scholarLookupHmac(
  scholarNumber: string,
  className: string,
  session: string,
): string {
  return studentIdentifierHmac(`${session}|${className}|${scholarNumber}`);
}

export function encryptStudentIdentifier(value: string): string {
  const normalized = normalizeStudentIdentifier(value);
  if (!normalized || normalized.length > 100) throw new Error("Invalid student identifier");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secret("STUDENT_PII_ENCRYPTION_KEY"), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptStudentIdentifier(value: string): string {
  const [version, ivText, tagText, encryptedText] = value.split(".");
  if (version !== "v1" || !ivText || !tagText || !encryptedText)
    throw new Error("Invalid encrypted student identifier");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    secret("STUDENT_PII_ENCRYPTION_KEY"),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export type DisambiguationClaims = {
  v: 1;
  sk: string;
  iph: string;
  iat: number;
  exp: number;
  nonce: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidChallengeClaims(
  value: unknown,
  ipHash: string,
  now: number,
): value is DisambiguationClaims {
  if (!isRecord(value)) return false;
  const issuedAt = value.iat;
  const expiresAt = value.exp;
  return (
    value.v === 1 &&
    typeof value.sk === "string" &&
    /^[a-f0-9]{64}$/.test(value.sk) &&
    value.iph === ipHash &&
    typeof issuedAt === "number" &&
    typeof expiresAt === "number" &&
    issuedAt <= now + 30 &&
    expiresAt > now &&
    expiresAt - issuedAt <= 120 &&
    typeof value.nonce === "string" &&
    /^[a-f0-9]{32}$/.test(value.nonce)
  );
}

export function signDisambiguationChallenge(
  claims: DisambiguationClaims,
  signingSecret: string,
): string {
  if (Buffer.byteLength(signingSecret, "utf8") < 32)
    throw new Error("DISAMBIGUATION_CHALLENGE_SECRET must be at least 32 bytes");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", signingSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyDisambiguationChallenge(
  token: string,
  signingSecret: string,
  ipHash: string,
  now = Math.floor(Date.now() / 1000),
): DisambiguationClaims | null {
  try {
    if (Buffer.byteLength(signingSecret, "utf8") < 32 || token.length > 2048) return null;
    const [payload, signature, ...remainingParts] = token.split(".");
    if (!payload || !signature || remainingParts.length > 0) return null;
    const expected = createHmac("sha256", signingSecret).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!isValidChallengeClaims(claims, ipHash, now)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function studentIdentityMatches(
  existing: {
    dateOfBirthDisambiguationKey?: unknown;
    admissionNumberDisambiguationKey?: unknown;
  },
  dateOfBirthDisambiguationKey: string,
  admissionNumberDisambiguationKey: string,
): boolean {
  if (!dateOfBirthDisambiguationKey && !admissionNumberDisambiguationKey) return false;
  const existingDob =
    typeof existing.dateOfBirthDisambiguationKey === "string"
      ? existing.dateOfBirthDisambiguationKey
      : "";
  const existingAdmission =
    typeof existing.admissionNumberDisambiguationKey === "string"
      ? existing.admissionNumberDisambiguationKey
      : "";
  const hasMatch = identityHasMatch(
    dateOfBirthDisambiguationKey,
    admissionNumberDisambiguationKey,
    existingDob,
    existingAdmission,
  );
  const hasConflict = identityHasConflict(
    dateOfBirthDisambiguationKey,
    admissionNumberDisambiguationKey,
    existingDob,
    existingAdmission,
  );
  return hasMatch && !hasConflict;
}

function identityHasMatch(
  dateOfBirthKey: string,
  admissionNumberKey: string,
  existingDob: string,
  existingAdmission: string,
): boolean {
  return Boolean(
    (dateOfBirthKey && existingDob === dateOfBirthKey) ||
    (admissionNumberKey && existingAdmission === admissionNumberKey),
  );
}

function identityHasConflict(
  dateOfBirthKey: string,
  admissionNumberKey: string,
  existingDob: string,
  existingAdmission: string,
): boolean {
  return Boolean(
    (dateOfBirthKey && existingDob && existingDob !== dateOfBirthKey) ||
    (admissionNumberKey && existingAdmission && existingAdmission !== admissionNumberKey),
  );
}
