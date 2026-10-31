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
    name === "STUDENT_PII_ENCRYPTION_KEY"
      ? Buffer.from(raw, "base64")
      : Buffer.from(raw, "utf8");
  if (name === "STUDENT_PII_ENCRYPTION_KEY" && value.length !== 32)
    throw new Error(`${name} must represent exactly 32 bytes`);
  if (name !== "STUDENT_PII_ENCRYPTION_KEY" && value.length < 32)
    throw new Error(`${name} must be at least 32 bytes`);
  return value;
}

export function normalizeStudentIdentifier(value: string): string {
  const normalized = value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
  const dmy = /^(\d{2})[-/.](\d{2})[-/.](\d{4})$/.exec(normalized);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return normalized;
}

export function studentIdentifierHmac(value: string): string {
  const normalized = normalizeStudentIdentifier(value);
  if (!normalized || normalized.length > 100)
    throw new Error("Invalid student identifier");
  return createHmac("sha256", secret("DISAMBIGUATION_HMAC_SECRET"))
    .update(normalized, "utf8")
    .digest("hex");
}

export function encryptStudentIdentifier(value: string): string {
  const normalized = normalizeStudentIdentifier(value);
  if (!normalized || normalized.length > 100)
    throw new Error("Invalid student identifier");
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    "aes-256-gcm",
    secret("STUDENT_PII_ENCRYPTION_KEY"),
    iv,
  );
  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
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
export function signDisambiguationChallenge(
  claims: DisambiguationClaims,
  signingSecret: string,
): string {
  if (Buffer.byteLength(signingSecret, "utf8") < 32)
    throw new Error(
      "DISAMBIGUATION_CHALLENGE_SECRET must be at least 32 bytes",
    );
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", signingSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyDisambiguationChallenge(
  token: string,
  signingSecret: string,
  ipHash: string,
  now = Math.floor(Date.now() / 1000),
): DisambiguationClaims | null {
  try {
    if (Buffer.byteLength(signingSecret, "utf8") < 32 || token.length > 2048)
      return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, signature] = parts as [string, string];
    const expected = createHmac("sha256", signingSecret)
      .update(payload)
      .digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const claims = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as DisambiguationClaims;
    if (
      claims.v !== 1 ||
      typeof claims.sk !== "string" ||
      !/^[a-f0-9]{64}$/.test(claims.sk) ||
      claims.iph !== ipHash ||
      typeof claims.iat !== "number" ||
      typeof claims.exp !== "number" ||
      claims.iat > now + 30 ||
      claims.exp <= now ||
      claims.exp - claims.iat > 120 ||
      typeof claims.nonce !== "string" ||
      !/^[a-f0-9]{32}$/.test(claims.nonce)
    )
      return null;
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
  if (!dateOfBirthDisambiguationKey && !admissionNumberDisambiguationKey)
    return false;
  const existingDob =
    typeof existing.dateOfBirthDisambiguationKey === "string"
      ? existing.dateOfBirthDisambiguationKey
      : "";
  const existingAdmission =
    typeof existing.admissionNumberDisambiguationKey === "string"
      ? existing.admissionNumberDisambiguationKey
      : "";
  const hasMatch = Boolean(
    (dateOfBirthDisambiguationKey &&
      existingDob === dateOfBirthDisambiguationKey) ||
    (admissionNumberDisambiguationKey &&
      existingAdmission === admissionNumberDisambiguationKey),
  );
  const hasConflict = Boolean(
    (dateOfBirthDisambiguationKey &&
      existingDob &&
      existingDob !== dateOfBirthDisambiguationKey) ||
    (admissionNumberDisambiguationKey &&
      existingAdmission &&
      existingAdmission !== admissionNumberDisambiguationKey),
  );
  return hasMatch && !hasConflict;
}
