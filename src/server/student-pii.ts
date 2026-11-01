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
  if (dmy) return normalized.replace(/^(\d{2})[-/.](\d{2})[-/.](\d{4})$/, "$3-$2-$1");
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
  if (value.split(".").length !== 4 || version !== "v1" || !ivText || !tagText || !encryptedText)
    throw new Error("Invalid encrypted student identifier");
  const decodeCanonical = (text: string): Buffer => {
    const decoded = Buffer.from(text, "base64url");
    if (decoded.toString("base64url") !== text)
      throw new Error("Invalid encrypted student identifier");
    return decoded;
  };
  const iv = decodeCanonical(ivText);
  const tag = decodeCanonical(tagText);
  const encrypted = decodeCanonical(encryptedText);
  if (iv.length !== 12 || tag.length !== 16)
    throw new Error("Invalid encrypted student identifier");
  const decipher = createDecipheriv("aes-256-gcm", secret("STUDENT_PII_ENCRYPTION_KEY"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export type DisambiguationClaims = {
  v: 1;
  sk: string;
  iph: string;
  iat: number;
  exp: number;
  nonce: string;
};
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
    const parts = token.split(".");
    const payload = parts[0];
    const signature = parts[1];
    if (parts.length !== 2 || payload === undefined || signature === undefined) return null;
    const expected = createHmac("sha256", signingSecret).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return isValidDisambiguationClaims(claims, ipHash, now) ? claims : null;
  } catch {
    return null;
  }
}

function isValidDisambiguationClaims(
  value: unknown,
  ipHash: string,
  now: number,
): value is DisambiguationClaims {
  if (!isRecord(value)) return false;
  return (
    value.v === 1 &&
    hasValidSearchKey(value) &&
    value.iph === ipHash &&
    hasValidChallengeExpiry(value, now) &&
    hasValidChallengeNonce(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidSearchKey(value: Record<string, unknown>): boolean {
  return typeof value.sk === "string" && /^[a-f0-9]{64}$/.test(value.sk);
}

function hasValidChallengeExpiry(value: Record<string, unknown>, now: number): boolean {
  return (
    typeof value.iat === "number" &&
    typeof value.exp === "number" &&
    value.iat <= now + 30 &&
    value.exp > now &&
    value.exp - value.iat <= 120
  );
}

function hasValidChallengeNonce(value: Record<string, unknown>): boolean {
  return typeof value.nonce === "string" && /^[a-f0-9]{32}$/.test(value.nonce);
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
  return (
    identifierMatches(existingDob, dateOfBirthDisambiguationKey) ||
    identifierMatches(existingAdmission, admissionNumberDisambiguationKey)
  ) && !identifierConflicts(existingDob, dateOfBirthDisambiguationKey)
    && !identifierConflicts(existingAdmission, admissionNumberDisambiguationKey);
}

function identifierMatches(existing: string, requested: string): boolean {
  return Boolean(requested && existing === requested);
}

function identifierConflicts(existing: string, requested: string): boolean {
  return Boolean(requested && existing && existing !== requested);
}
