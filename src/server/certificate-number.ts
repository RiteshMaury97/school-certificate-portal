import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { assertEnvironmentFor } from "./env";

function key(): Buffer {
  assertEnvironmentFor("certificate numbers", ["CERTIFICATE_NUMBER_ENCRYPTION_KEY"]);
  const encoded = process.env.CERTIFICATE_NUMBER_ENCRYPTION_KEY;
  if (!encoded)
    throw new Error("CERTIFICATE_NUMBER_ENCRYPTION_KEY is not configured");
  const value = Buffer.from(encoded, "base64");
  if (value.byteLength !== 32)
    throw new Error(
      "CERTIFICATE_NUMBER_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
    );
  return value;
}
export function encryptCertificateNumber(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value.normalize("NFKC").trim(), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}
export function decryptCertificateNumber(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  const [ivPart, tagPart, cipherPart] = value.split(".");
  if (!ivPart || !tagPart || !cipherPart) return "";
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
