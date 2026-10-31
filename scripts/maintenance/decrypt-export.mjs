import { readFile, writeFile } from "node:fs/promises";
import { createDecipheriv, scryptSync } from "node:crypto";
const [input, output, ...passphraseParts] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    "Usage: node scripts/maintenance/decrypt-export.mjs export.enc output.json [passphrase]",
  );
const envelope = JSON.parse(await readFile(input, "utf8"));
if (envelope.version !== 1 || envelope.algorithm !== "AES-256-GCM")
  throw new Error("Unsupported encrypted export format.");
let key;
if (envelope.kdf === "scrypt-passphrase") {
  const passphrase = passphraseParts.join(" ");
  if (!passphrase)
    throw new Error("Supply the passphrase used when exporting.");
  key = scryptSync(passphrase, Buffer.from(envelope.salt, "base64"), 32);
} else if (envelope.kdf === "env-key") {
  if (!process.env.EXPORT_ENCRYPTION_KEY)
    throw new Error(
      "Set EXPORT_ENCRYPTION_KEY to the same key used for export.",
    );
  key = Buffer.from(process.env.EXPORT_ENCRYPTION_KEY, "base64");
  if (key.length !== 32)
    throw new Error("EXPORT_ENCRYPTION_KEY must decode to 32 bytes.");
} else throw new Error("Unknown key derivation mode.");
const decipher = createDecipheriv(
  "aes-256-gcm",
  key,
  Buffer.from(envelope.iv, "base64"),
);
decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
const plain = Buffer.concat([
  decipher.update(Buffer.from(envelope.ciphertext, "base64")),
  decipher.final(),
]);
await writeFile(output, plain, { mode: 0o600 });
console.log(`Decrypted ${envelope.format} export to ${output}`);
