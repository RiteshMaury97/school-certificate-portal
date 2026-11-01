import "server-only";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";

import { FieldPath } from "firebase-admin/firestore";

import { db } from "@/server/firebase-admin";

export type ExportFormat = "json" | "csv";
function encryptionKey(
  passphrase?: string,
  salt?: Buffer,
): { key: Buffer; salt: Buffer; mode: string } {
  const env = process.env.EXPORT_ENCRYPTION_KEY;
  if (passphrase) {
    const actualSalt = salt ?? randomBytes(16);
    return {
      key: scryptSync(passphrase, actualSalt, 32),
      salt: actualSalt,
      mode: "scrypt-passphrase",
    };
  }
  if (!env)
    throw new Error("Configure EXPORT_ENCRYPTION_KEY or provide a passphrase.");
  const key = Buffer.from(env, "base64");
  if (key.length !== 32)
    throw new Error(
      "EXPORT_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  return { key, salt: Buffer.alloc(0), mode: "env-key" };
}
function plainValue(value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  )
    return (value as { toDate: () => Date }).toDate().toISOString();
  if (Array.isArray(value)) return value.map(plainValue);
  if (value && typeof value === "object" && !Buffer.isBuffer(value))
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, plainValue(v)]),
    );
  return value;
}
export async function collectExportData(): Promise<Record<string, unknown[]>> {
  const result: Record<string, unknown[]> = {};
  const collections = await db.listCollections();
  for (const collection of collections) {
    const name = collection.id;
    const rows: unknown[] = [];
    let page = await collection
      .orderBy(FieldPath.documentId())
      .limit(500)
      .get();
    while (!page.empty) {
      rows.push(
        ...page.docs.map((doc) => ({
          id: doc.id,
          ...(plainValue(doc.data()) as Record<string, unknown>),
        })),
      );
      if (page.size < 500) break;
      page = await collection
        .orderBy(FieldPath.documentId())
        .startAfter(page.docs[page.docs.length - 1]!)
        .limit(500)
        .get();
    }
    result[name] = rows;
  }
  return result;
}
function toCsv(data: Record<string, unknown[]>): string {
  const lines = ["collection,id,data"];
  for (const [collection, docs] of Object.entries(data))
    for (const doc of docs) {
      const item = doc as Record<string, unknown>;
      const cell = (value: unknown) =>
        `"${String(value ?? "").replace(/"/g, '""')}"`;
      lines.push(
        [collection, cell(item.id), cell(JSON.stringify(item))].join(","),
      );
    }
  return lines.join("\r\n");
}
export async function createEncryptedExport(
  format: ExportFormat,
  passphrase?: string,
): Promise<Buffer> {
  const data = await collectExportData();
  const plain = Buffer.from(
    format === "csv"
      ? toCsv(data)
      : JSON.stringify(
          { exportedAt: new Date().toISOString(), collections: data },
          null,
          2,
        ),
    "utf8",
  );
  const salt = passphrase ? randomBytes(16) : undefined;
  const material = encryptionKey(passphrase, salt);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", material.key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const envelope = {
    version: 1,
    algorithm: "AES-256-GCM",
    kdf: material.mode,
    format,
    salt: material.salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
  return Buffer.from(JSON.stringify(envelope), "utf8");
}
