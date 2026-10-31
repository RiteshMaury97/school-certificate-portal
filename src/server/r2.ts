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

const MAX_FILE_BYTES = 5 * 1024 * 1024;
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
function detectFile(buffer: Buffer): {
  mimeType: keyof typeof allowedTypes;
  extension: string;
} {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-")
    return { mimeType: "application/pdf", extension: ".pdf" };
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  )
    return { mimeType: "image/jpeg", extension: ".jpg" };
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(png))
    return { mimeType: "image/png", extension: ".png" };
  throw new Error("File content is not a supported PDF, JPG or PNG");
}
function validateSession(session: string): void {
  if (!/^\d{4}-\d{2}$/.test(session)) throw new Error("Invalid session");
}
function validateCertificateKey(key: string): void {
  if (
    !/^certificates\/\d{4}-\d{2}\/[a-z0-9-]{1,60}\/[0-9a-f-]{36}\.(pdf|jpg|png)$/.test(
      key,
    )
  ) {
    throw new Error("Invalid certificate object reference");
  }
}

const MAX_PDF_PAGES = 100;
async function validatePdf(buffer: Buffer): Promise<void> {
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
    throw new Error(`PDF must contain between 1 and ${MAX_PDF_PAGES} pages.`);
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
  const inspect = (value: unknown): boolean => {
    if (!value || typeof value !== "object" || seen.has(value)) return false;
    seen.add(value);
    if (value instanceof PDFRef) return inspect(document.context.lookup(value));
    if (value instanceof PDFName) return unsafeNames.has(value.toString());
    if (value instanceof PDFDict) {
      for (const [key, child] of (value).entries())
        if (unsafeNames.has(key.toString()) || inspect(child)) return true;
    }
    if (value instanceof PDFArray)
      for (const child of (value).asArray())
        if (inspect(child)) return true;
    return false;
  };
  if (inspect(document.catalog))
    throw new Error(
      "PDFs containing scripts, automatic actions or embedded attachments are not accepted.",
    );
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
  if (!response.ok)
    throw new Error(
      "Antivirus scanning is unavailable; upload was not accepted.",
    );
  const result: unknown = await response.json().catch(() => null);
  if (
    !result ||
    typeof result !== "object" ||
    !("clean" in result) ||
    result.clean !== true
  ) {
    throw new Error("The uploaded file did not pass the antivirus scan.");
  }
}
export async function createCertificatePreviewUrl(
  r2Key: string,
): Promise<string> {
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
export async function uploadCertificate(
  file: File,
  session: string,
  certificateType: string,
  studentId?: string,
): Promise<R2Upload> {
  if (file.size <= 0 || file.size > MAX_FILE_BYTES)
    throw new Error("Certificate must be between 1 byte and 5 MB");
  validateSession(session);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength !== file.size)
    throw new Error("File size validation failed");
  const detected = detectFile(buffer);
  if (file.type && file.type !== detected.mimeType)
    throw new Error("File content does not match its declared type");
  if (detected.mimeType === "application/pdf") await validatePdf(buffer);
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
  const result = await client().send(
    new GetObjectCommand({ Bucket: bucket(), Key: r2Key }),
  );
  if (!result.Body) throw new Error("Certificate object is unavailable");
  if (
    typeof result.ContentLength === "number" &&
    result.ContentLength > MAX_FILE_BYTES
  ) {
    throw new Error("Certificate object exceeds the processing limit");
  }
  const bytes = await result.Body.transformToByteArray();
  if (bytes.byteLength > MAX_FILE_BYTES)
    throw new Error("Certificate object exceeds the processing limit");
  return Buffer.from(bytes);
}
export async function streamR2Object(r2Key: string) {
  validateCertificateKey(r2Key);
  const result = await client().send(
    new GetObjectCommand({ Bucket: bucket(), Key: r2Key }),
  );
  if (!result.Body) throw new Error("Certificate object is unavailable");
  return result.Body;
}
/** Preserve deleted/replaced originals under a private prefix for 30 days. Configure
 * an R2 lifecycle expiration rule for _soft-delete/ objects after 30 days. */
export async function softDeleteR2Object(
  r2Key: string,
  studentId?: string,
): Promise<void> {
  validateCertificateKey(r2Key);
  const s3 = client();
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: r2Key }));
  } catch (error) {
    if (
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 404
    )
      return;
    throw error;
  }
  const suffix = r2Key.split("/").pop() ?? randomUUID();
  const archiveKey = `_soft-delete/${Date.now()}-${randomUUID()}-${suffix}`;
  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket(),
      Key: archiveKey,
      CopySource: `${bucket()}/${r2Key}`,
      MetadataDirective: studentId ? "REPLACE" : "COPY",
      ...(studentId
        ? {
            Metadata: {
              ...(
                await s3.send(
                  new HeadObjectCommand({ Bucket: bucket(), Key: r2Key }),
                )
              ).Metadata,
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
    if (
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 404
    )
      return false;
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
  let deleted = 0,
    ambiguous = 0,
    unattributed = 0;
  for (const prefix of ["certificates/", "_soft-delete/"]) {
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
        if (!item.Key) continue;
        const head = await s3.send(
          new HeadObjectCommand({ Bucket: bucket(), Key: item.Key }),
        );
        const metadataStudent = head.Metadata?.studentid;
        const sha = head.Metadata?.sha256;
        if (metadataStudent === studentId) {
          await s3.send(
            new DeleteObjectCommand({ Bucket: bucket(), Key: item.Key }),
          );
          deleted++;
        } else if (!metadataStudent) {
          // Legacy objects without an owner tag cannot be deleted by hash alone.
          if (sha && knownSha256s.includes(sha)) ambiguous++;
          else unattributed++;
        }
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  }
  return { deleted, ambiguous, unattributed };
}
