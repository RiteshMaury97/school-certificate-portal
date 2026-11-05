import { NextResponse } from "next/server";

import { formString } from "@/app/api/_lib/form-data";
import { db } from "@/server/firebase-admin";
import { certificateTypeSlug } from "@/server/r2";
import { requireRoles, apiError, createCertificateNumberHash } from "@/server/security";
import { studentIdentifierHmac } from "@/server/student-pii";
import { rejectOversizedRequest } from "@/server/upload-policy";
import { normalizeAcademicSession } from "@/shared/academic-session";
import {
  MAX_BULK_FILES,
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  UPLOAD_MAX_BYTES,
} from "@/shared/upload-limits";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function isManifestFile(value: unknown): value is { name: string; size: number } {
  if (typeof value !== "object" || value === null) return false;
  const name: unknown = Reflect.get(value, "name");
  const size: unknown = Reflect.get(value, "size");
  return typeof name === "string" && typeof size === "number";
}
function safeTypeSlug(value: string): string {
  try {
    return certificateTypeSlug(value);
  } catch {
    return "";
  }
}
function sessionOf(document: { get(field: string): unknown }): string {
  const value: unknown = document.get("session");
  return typeof value === "string" ? (normalizeAcademicSession(value) ?? "") : "";
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const consumed = consumeCsvCharacter(text[i], text[i + 1], { rows, row, cell, quoted });
    row = consumed.row;
    cell = consumed.cell;
    quoted = consumed.quoted;
    i += consumed.skip;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows.filter((item) => !item[0]?.startsWith("#"));
}

function consumeCsvCharacter(
  character: string | undefined,
  next: string | undefined,
  state: { rows: string[][]; row: string[]; cell: string; quoted: boolean },
): { row: string[]; cell: string; quoted: boolean; skip: number } {
  const { row, cell, quoted } = state;
  if (character === undefined) return { row, cell, quoted, skip: 0 };
  if (character === '"') return consumeQuote(next, row, cell, quoted);
  if (character === "," && !quoted) {
    row.push(cell.trim());
    return { row, cell: "", quoted, skip: 0 };
  }
  if (isCsvLineBreak(character, quoted)) {
    const skip = character === "\r" && next === "\n" ? 1 : 0;
    row.push(cell.trim());
    if (row.some(Boolean)) state.rows.push(row);
    return { row: [], cell: "", quoted, skip };
  }
  return { row, cell: cell + character, quoted, skip: 0 };
}

function consumeQuote(next: string | undefined, row: string[], cell: string, quoted: boolean) {
  return quoted && next === '"'
    ? { row, cell: `${cell}"`, quoted, skip: 1 }
    : { row, cell, quoted: !quoted, skip: 0 };
}

function isCsvLineBreak(character: string, quoted: boolean): boolean {
  return !quoted && (character === "\n" || character === "\r");
}

type MappingRow = Record<string, string>;
type PreviewFile = { name: string; size: number };

function filenamePattern(fileName: string): RegExpExecArray | null {
  return /^([^_]+)_(.+)\.(pdf|jpe?g|png)$/i.exec(fileName);
}

function matchesFilename(row: MappingRow, fileName: string): boolean {
  return (row.filename ?? row.file ?? "") === fileName;
}

function matchesInferredMapping(row: MappingRow, pattern: RegExpExecArray | null): boolean {
  const admission = row.admissionnumber ?? row.admissionno ?? "";
  if (pattern?.[1] !== admission) return false;
  const rowType = row.certificatetype ?? row.type ?? "";
  if (!rowType) return true;
  const inferredType = (pattern[2] ?? "").replace(/[-_]+/g, " ");
  return safeTypeSlug(rowType) === safeTypeSlug(inferredType);
}

function findMappingRow(fileName: string, values: MappingRow[]): MappingRow | undefined {
  const pattern = filenamePattern(fileName);
  return values.find(
    (row) => matchesFilename(row, fileName) || matchesInferredMapping(row, pattern),
  );
}

async function findStudent(row: MappingRow, admissionNo: string) {
  if (row.studentid) return db.collection("students").doc(row.studentid).get();
  if (!admissionNo) return null;
  const admissionKey = studentIdentifierHmac(admissionNo);
  const current = await db
    .collection("students")
    .where("admissionNumberDisambiguationKey", "==", admissionKey)
    .limit(2)
    .get();
  if (current.size === 1) return current.docs.at(0) ?? null;
  if (current.size > 1) return null;
  const legacy = await db
    .collection("students")
    .where("admissionNo", "==", admissionNo)
    .limit(2)
    .get();
  return legacy.size === 1 ? (legacy.docs.at(0) ?? null) : null;
}

async function validateNumber(
  number: string,
  seenNumbers: Set<string>,
  errors: string[],
): Promise<void> {
  if (!number) {
    errors.push("Certificate number is required.");
    return;
  }
  const hash = createCertificateNumberHash(number);
  if (seenNumbers.has(hash)) errors.push("Duplicate certificate number in this batch.");
  seenNumbers.add(hash);
  const existing = await db.collection("certificateNumberIndex").doc(hash).get();
  if (existing.exists) errors.push("Certificate number is already assigned.");
}

async function validateStudent(
  row: MappingRow,
  admissionNo: string,
  session: string,
  errors: string[],
): Promise<void> {
  const student = await findStudent(row, admissionNo);
  if (!student?.exists) {
    errors.push("Student/admission number did not match exactly one student.");
    return;
  }
  if (sessionOf(student) !== normalizeAcademicSession(session))
    errors.push("Certificate session must match the student's passing session.");
}

async function validateCatalog(session: string, type: string, errors: string[]): Promise<void> {
  if (/^\d{4}-\d{2}$/.test(session)) {
    const sessionDoc = await db.collection("sessions").doc(session).get();
    if (!sessionDoc.exists || sessionDoc.get("isActive") === false)
      errors.push("Session is not configured/active.");
  }
  if (type.length < 2) return;
  const typeSlug = safeTypeSlug(type);
  if (!typeSlug) {
    errors.push("Certificate type is invalid.");
    return;
  }
  const typeDoc = await db.collection("certificateTypes").doc(typeSlug).get();
  if (!typeDoc.exists) errors.push("Certificate type is not configured.");
}

function resolvedMapping(row: MappingRow, fileName: string) {
  const pattern = filenamePattern(fileName);
  const inferredType = (pattern?.[2] ?? "").replace(/[-_]+/g, " ");
  return {
    session: row.session ?? "",
    type: row.certificatetype ?? row.type ?? inferredType,
    number: row.certificatenumber ?? "",
    date: row.issuedate ?? "",
    admissionNo: row.admissionnumber ?? row.admissionno ?? pattern?.[1] ?? "",
    pattern,
  };
}

function validateBasicFields(session: string, type: string, date: string, errors: string[]): void {
  if (!/^\d{4}-\d{2}$/.test(session)) errors.push("Invalid session.");
  if (type.length < 2)
    errors.push("Certificate type is required (or use admissionNo_type.pdf naming). ");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("Issue date must be YYYY-MM-DD.");
}

async function validateMappingRow(
  row: MappingRow,
  file: PreviewFile,
  seenNumbers: Set<string>,
): Promise<string[]> {
  const resolved = resolvedMapping(row, file.name);
  const errors: string[] = [];
  validateBasicFields(resolved.session, resolved.type, resolved.date, errors);
  await validateNumber(resolved.number, seenNumbers, errors);
  await validateStudent(row, resolved.admissionNo, resolved.session, errors);
  await validateCatalog(resolved.session, resolved.type, errors);
  return errors;
}

function mappedValues(fileName: string, row?: MappingRow) {
  if (!row) return null;
  const resolved = resolvedMapping(row, fileName);
  return {
    fileName,
    admissionNo: resolved.admissionNo,
    studentId: row.studentid ?? "",
    session: resolved.session,
    certificateType: resolved.type,
    certificateNumber: resolved.number,
    issueDate: resolved.date,
  };
}

async function previewFile(file: PreviewFile, values: MappingRow[], seenNumbers: Set<string>) {
  const row = findMappingRow(file.name, values);
  const errors: string[] = [];
  if (!row) errors.push("No mapping row for this filename.");
  if (file.size <= 0 || file.size > UPLOAD_MAX_BYTES) errors.push("File must be 1 byte to 4 MB.");
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name))
    errors.push("File extension must be PDF, JPG or PNG.");
  if (row) errors.push(...(await validateMappingRow(row, file, seenNumbers)));
  return {
    fileName: file.name,
    size: file.size,
    valid: errors.length === 0,
    errors,
    mapping: mappedValues(file.name, row),
  };
}

async function previewRequest(request: NextRequest): Promise<NextResponse> {
  await requireRoles(request, ["uploader", "admin"]);
  const tooLarge = rejectOversizedRequest(request, MAX_CSV_BYTES);
  if (tooLarge) return tooLarge;
  const form = await request.formData();
  const csv = form.get("mappingCsv");
  if (!(csv instanceof File) || csv.size > MAX_CSV_BYTES)
    return NextResponse.json(
      { error: "Provide a mapping CSV smaller than 2 MB." },
      { status: 400 },
    );
  let manifest: unknown;
  try {
    manifest = JSON.parse(formString(form, "fileManifest") || "[]");
  } catch {
    return NextResponse.json({ error: "File manifest is invalid." }, { status: 400 });
  }
  const files = Array.isArray(manifest) ? manifest.filter(isManifestFile) : [];
  if (!validManifest(manifest, files))
    return NextResponse.json({ error: "Provide between 1 and 20 files." }, { status: 400 });
  const values = csvMappings(parseCsv(await csv.text()));
  if (values instanceof NextResponse) return values;
  const seenNumbers = new Set<string>();
  const preview = [];
  for (const file of files) preview.push(await previewFile(file, values, seenNumbers));
  return NextResponse.json(
    { total: preview.length, valid: preview.filter((item) => item.valid).length, preview },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function validManifest(manifest: unknown, files: { name: string; size: number }[]): boolean {
  if (files.length < 1 || files.length > MAX_BULK_FILES) return false;
  return !Array.isArray(manifest) || files.length === manifest.length;
}

function csvMappings(rows: string[][]): MappingRow[] | NextResponse {
  if (rows.length < 2 || rows.length - 1 > MAX_CSV_ROWS)
    return NextResponse.json(
      { error: `Mapping CSV needs headers and 1 to ${String(MAX_CSV_ROWS)} rows.` },
      { status: 400 },
    );
  const headerRow = rows[0];
  if (!headerRow)
    return NextResponse.json({ error: "Mapping CSV has no header row." }, { status: 400 });
  const headers = headerRow.map((value) => value.toLowerCase().replace(/\s+/g, ""));
  return rows
    .slice(1)
    .map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])),
    );
}

export async function POST(request: NextRequest) {
  try {
    return await previewRequest(request);
  } catch (error) {
    return apiError(error);
  }
}
