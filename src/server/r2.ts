import "server-only";
import { createHash, randomUUID } from "node:crypto";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PDFDocument, PDFArray, PDFDict, PDFName, PDFRef } from "pdf-lib";
import sharp from "sharp";

import { incrementDailySecurityMetric } from "@/server/daily-security-summary";
import { MAX_IMAGE_PIXELS, MAX_PDF_PAGES, UPLOAD_MAX_BYTES } from "@/shared/upload-limits";

const MAX_FILE_BYTES = UPLOAD_MAX_BYTES;
const allowedTypes = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
} as const;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
function isNotFoundError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("$metadata" in error)) return false;
  const metadata: unknown = error.$metadata;
  if (typeof metadata !== "object" || metadata === null || !("httpStatusCode" in metadata))
    return false;
  return metadata.httpStatusCode === 404;
}
function bucket(): string {
  return required("R2_BUCKET");
}
function client(): S3Client {
  const accountId = required("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
    forcePathStyle: true,
  });
}
export function certificateTypeSlug(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  if (!slug) throw new Error("Invalid certificate type");
  return slug;
}
export function detectFile(buffer: Buffer): {
  mimeType: keyof typeof allowedTypes;
  extension: string;
} {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-")
    return { mimeType: "application/pdf", extension: allowedTypes["application/pdf"] };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return { mimeType: "image/jpeg", extension: allowedTypes["image/jpeg"] };
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(png))
    return { mimeType: "image/png", extension: allowedTypes["image/png"] };
  throw new Error("File content is not a supported PDF, JPG or PNG");
}
function validateSession(session: string): void {
  if (!/^\d{4}-\d{2}$/.test(session)) throw new Error("Invalid session");
}
function validateCertificateKey(key: string): void {
  if (!/^certificates\/\d{4}-\d{2}\/[a-z0-9-]{1,60}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(key)) {
    throw new Error("Invalid certificate object reference");
  }
}

export async function validatePdf(buffer: Buffer): Promise<void> {
  if (/\/Encrypt\b/.test(buffer.toString("latin1")))
    throw new Error("PDF is invalid, encrypted or password-protected.");
  let document: PDFDocument;
  try {
    document = await PDFDocument.load(buffer, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
  } catch {
    throw new Error("PDF is invalid, encrypted or password-protected.");
  }
  if (document.getPageCount() < 1 || document.getPageCount() > MAX_PDF_PAGES) {
    throw new Error(`PDF must contain between 1 and ${String(MAX_PDF_PAGES)} pages.`);
  }
  // Inspect the parsed object graph as well as raw bytes (object streams may be compressed).
  const unsafeNames = new Set([
    "/JavaScript",
    "/JS",
    "/EmbeddedFiles",
    "/EmbeddedFile",
    "/Filespec",
    "/OpenAction",
    "/AA",
    "/AF",
    "/Launch",
    "/RichMedia",
    "/SubmitForm",
    "/ImportData",
    "/XFA",
  ]);
  const seen = new Set<object>();
  if (containsUnsafePdfEntry(document.catalog, document, seen, unsafeNames))
    throw new Error(
      "PDFs containing scripts, automatic actions or embedded attachments are not accepted.",
    );
}

function containsUnsafePdfEntry(
    value: unknown,
    document: PDFDocument,
    seen: Set<object>,
    unsafeNames: Set<string>,
): boolean {
    if (!value || typeof value !== "object" || seen.has(value)) return false;
    seen.add(value);
    if (value instanceof PDFRef)
      return containsUnsafePdfEntry(document.context.lookup(value), document, seen, unsafeNames);
    if (value instanceof PDFName) return unsafeNames.has(value.toString());
    if (value instanceof PDFDict)
      return containsUnsafePdfDictionary(value, document, seen, unsafeNames);
    return value instanceof PDFArray && containsUnsafePdfArray(value, document, seen, unsafeNames);
}

function containsUnsafePdfDictionary(
    value: PDFDict,
    document: PDFDocument,
    seen: Set<object>,
    unsafeNames: Set<string>,
): boolean {
    for (const [key, child] of value.entries()) {
      if (
        unsafeNames.has(key.toString()) ||
        containsUnsafePdfEntry(child, document, seen, unsafeNames)
      )
        return true;
    }
    return false;
}

function containsUnsafePdfArray(
    value: PDFArray,
    document: PDFDocument,
    seen: Set<object>,
    unsafeNames: Set<string>,
): boolean {
    for (const child of value.asArray()) {
      if (containsUnsafePdfEntry(child, document, seen, unsafeNames)) return true;
    }
    return false;
}
async function scanForMalware(buffer: Buffer, mimeType: string): Promise<void> {
  const endpoint = process.env.ANTIVIRUS_SCAN_URL;
  if (!endpoint) return;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      Authorization: `Bearer ${process.env.ANTIVIRUS_SCAN_TOKEN ?? ""}`,
    },
    body: new Uint8Array(buffer),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Antivirus scanning is unavailable; upload was not accepted.");
  const result: unknown = await response.json().catch(() => null);
  if (!result || typeof result !== "object" || !("clean" in result) || result.clean !== true) {
    throw new Error("The uploaded file did not pass the antivirus scan.");
  }
}
export async function createCertificatePreviewUrl(r2Key: string): Promise<string> {
  validateCertificateKey(r2Key);
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: r2Key,
      ResponseCacheControl: "no-store",
      ResponseContentDisposition: "inline",
    }),
    { expiresIn: 60 },
  );
}

export type R2Upload = {
  r2Key: string;
  size: number;
  mimeType: string;
  sha256: string;
  fileName: string;
};
export async function getR2StorageUsage(): Promise<{ bytes: number; uploadsToday: number }> {
  const s3 = client();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let bytes = 0,
    uploadsToday = 0,
    token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket(), ContinuationToken: token, MaxKeys: 1000 }),
    );
    for (const item of page.Contents ?? []) {
      bytes += item.Size ?? 0;
      if (item.LastModified && item.LastModified >= today) uploadsToday++;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return { bytes, uploadsToday };
}
export async function uploadCertificate(
  file: File,
  session: string,
  certificateType: string,
  studentId?: string,
): Promise<R2Upload> {
  if (file.size <= 0 || file.size > MAX_FILE_BYTES)
    throw new Error("Certificate must be between 1 byte and 4 MB");
  validateSession(session);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength !== file.size) throw new Error("File size validation failed");
  const detected = detectFile(buffer);
  const extension = file.name.toLowerCase().split(".").pop();
  const expectedExtension = extension === "jpeg" ? ".jpg" : `.${String(extension)}`;
  if (expectedExtension !== detected.extension)
    throw new Error("File extension does not match its content.");
  if (file.type !== detected.mimeType)
    throw new Error("File content does not match its declared type");
  if (detected.mimeType === "application/pdf") await validatePdf(buffer);
  else {
    const metadata = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
    if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS)
      throw new Error("Image exceeds the 40 megapixel limit.");
  }
  await scanForMalware(buffer, detected.mimeType);
  const slug = certificateTypeSlug(certificateType);
  const r2Key = `certificates/${session}/${slug}/${randomUUID()}${detected.extension}`;
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: r2Key,
      Body: buffer,
      ContentLength: buffer.byteLength,
      ContentType: detected.mimeType,
      Metadata: { sha256, ...(studentId ? { studentid: studentId } : {}) },
    }),
  );
  await incrementDailySecurityMetric("uploads").catch(() => null);
  return {
    r2Key,
    size: buffer.byteLength,
    mimeType: detected.mimeType,
    sha256,
    fileName: file.name.slice(0, 255),
  };
}
export async function readR2Object(r2Key: string): Promise<Buffer> {
  validateCertificateKey(r2Key);
  const result = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: r2Key }));
  if (!result.Body) throw new Error("Certificate object is unavailable");
  if (typeof result.ContentLength === "number" && result.ContentLength > MAX_FILE_BYTES) {
    throw new Error("Certificate object exceeds the processing limit");
  }
  const bytes = await result.Body.transformToByteArray();
  if (bytes.byteLength > MAX_FILE_BYTES)
    throw new Error("Certificate object exceeds the processing limit");
  return Buffer.from(bytes);
}
export async function streamR2Object(r2Key: string) {
  validateCertificateKey(r2Key);
  const result = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: r2Key }));
  if (!result.Body) throw new Error("Certificate object is unavailable");
  return result.Body;
}
/** Preserve deleted/replaced originals under a private prefix for 30 days. Configure
 * an R2 lifecycle expiration rule for _soft-delete/ objects after 30 days. */
export async function softDeleteR2Object(r2Key: string, studentId?: string): Promise<void> {
  validateCertificateKey(r2Key);
  const s3 = client();
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: r2Key }));
  } catch (error) {
    if (isNotFoundError(error)) return;
    throw error;
  }
  const suffix = r2Key.split("/").pop() ?? randomUUID();
  const archiveKey = `_soft-delete/${String(Date.now())}-${randomUUID()}-${suffix}`;
  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket(),
      Key: archiveKey,
      CopySource: `${bucket()}/${r2Key}`,
      MetadataDirective: studentId ? "REPLACE" : "COPY",
      ...(studentId
        ? {
            Metadata: {
              ...(await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: r2Key }))).Metadata,
              studentid: studentId,
            },
          }
        : {}),
    }),
  );
  await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: r2Key }));
}
export async function deleteR2Object(r2Key: string): Promise<boolean> {
  validateCertificateKey(r2Key);
  const s3 = client();
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: r2Key }));
  } catch (error) {
    if (isNotFoundError(error)) return false;
    throw error;
  }
  await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: r2Key }));
  return true;
}
export async function purgeStudentR2Objects(
  studentId: string,
  knownSha256s: string[] = [],
): Promise<{ deleted: number; ambiguous: number; unattributed: number }> {
  const s3 = client();
  const result = { deleted: 0, ambiguous: 0, unattributed: 0 };
  for (const prefix of ["certificates/", "_soft-delete/"]) {
    const prefixResult = await purgeStudentR2Prefix(s3, prefix, studentId, knownSha256s);
    result.deleted += prefixResult.deleted;
    result.ambiguous += prefixResult.ambiguous;
    result.unattributed += prefixResult.unattributed;
  }
  return result;
}

async function purgeStudentR2Prefix(
  s3: S3Client,
  prefix: string,
  studentId: string,
  knownSha256s: string[],
): Promise<{ deleted: number; ambiguous: number; unattributed: number }> {
  const result = { deleted: 0, ambiguous: 0, unattributed: 0 };
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 500,
      }),
    );
    for (const item of page.Contents ?? []) {
      const outcome = await purgeStudentR2Object(s3, item.Key, studentId, knownSha256s);
      if (outcome === "deleted") result.deleted++;
      else if (outcome === "ambiguous") result.ambiguous++;
      else if (outcome === "unattributed") result.unattributed++;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return result;
}

async function purgeStudentR2Object(
  s3: S3Client,
  key: string | undefined,
  studentId: string,
  knownSha256s: string[],
): Promise<"deleted" | "ambiguous" | "unattributed" | "skipped"> {
  if (!key) return "skipped";
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  const metadataStudent = head.Metadata?.studentid;
  const sha = head.Metadata?.sha256;
  if (metadataStudent === studentId) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    return "deleted";
  }
  if (metadataStudent) return "skipped";
  // Legacy objects without an owner tag cannot be deleted by hash alone.
  return sha && knownSha256s.includes(sha) ? "ambiguous" : "unattributed";
}
