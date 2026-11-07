import ExcelJS from "exceljs";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { formString } from "@/app/api/_lib/form-data";
import { db } from "@/server/firebase-admin";
import { createSearchKey, requireRoles, writeAuditLog, apiError } from "@/server/security";
import {
  encryptStudentIdentifier,
  scholarLookupHmac,
  studentIdentifierHmac,
  studentIdentityMatches,
} from "@/server/student-pii";
import { consumeAdminUploadQuota, rejectOversizedRequest } from "@/server/upload-policy";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { MAX_CSV_BYTES, MAX_CSV_ROWS } from "@/shared/upload-limits";
import { studentCreateSchema } from "@/shared/validation";

import type { Cell } from "exceljs";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
export const runtime = "nodejs";
const importFields = {
  scholarNumber: ["scholarnumber"],
  className: ["classname"],
  admissionNumber: ["admissionnumber", "admissionno"],
  dateOfBirth: ["dateofbirth"],
  studentName: ["studentname"],
  fatherName: ["fathername"],
  motherName: ["mothername"],
  session: ["session"],
} as const;
const requiredFields = [
  "studentName",
  "fatherName",
  "motherName",
  "className",
  "scholarNumber",
  "session",
] as const;
const fieldLabels: Record<string, string> = {
  admissionNumber: "admissionNumber",
  dateOfBirth: "dateOfBirth",
  studentName: "studentName",
  fatherName: "fatherName",
  motherName: "motherName",
  className: "className",
  scholarNumber: "scholarNumber",
  session: "session",
};

type SourceRow = { row: number; cells: string[] };
type ImportData = {
  admissionNumber: string;
  dateOfBirth: string;
  studentName: string;
  fatherName: string;
  motherName: string;
  className: string;
  scholarNumber: string;
  session: string;
  admissionNo: string;
};
type ImportCellError = { column: string; message: string };
type PreviewRow = {
  row: number;
  data: ImportData | null;
  values: Record<string, string>;
  error: string | null;
  fieldErrors: ImportCellError[];
};

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  const state = { row: [] as string[], cell: "", quoted: false };
  for (let i = 0; i < text.length; i++) {
    i += consumeImportCsvCharacter(text, i, state, rows);
  }
  appendImportCsvRow(rows, state.row, state.cell);
  return rows.filter((item) => !item[0]?.startsWith("#"));
}

function consumeImportCsvCharacter(
  text: string,
  index: number,
  state: { row: string[]; cell: string; quoted: boolean },
  rows: string[][],
): number {
  const character = text[index];
  if (character === undefined) return 0;
  if (character === '"') return toggleImportCsvQuote(text, index, state);
  if (character === "," && !state.quoted) {
    state.row.push(state.cell.trim());
    state.cell = "";
    return 0;
  }
  if (isImportCsvNewline(character, state.quoted)) {
    appendImportCsvRow(rows, state.row, state.cell);
    state.row = [];
    state.cell = "";
    return character === "\r" && text[index + 1] === "\n" ? 1 : 0;
  }
  state.cell += character;
  return 0;
}

function toggleImportCsvQuote(
  text: string,
  index: number,
  state: { row: string[]; cell: string; quoted: boolean },
): number {
  if (state.quoted && text[index + 1] === '"') {
    state.cell += '"';
    return 1;
  }
  state.quoted = !state.quoted;
  return 0;
}

function isImportCsvNewline(character: string, quoted: boolean): boolean {
  return !quoted && (character === "\n" || character === "\r");
}

function appendImportCsvRow(rows: string[][], row: string[], cell: string): void {
  const completeRow = [...row, cell.trim()];
  if (completeRow.some(Boolean)) rows.push(completeRow);
}

function cellText(cell: Cell): string {
  if (cell.value instanceof Date) return cell.value.toISOString().slice(0, 10);
  if (typeof cell.value === "object" && cell.value !== null && "formula" in cell.value) return "";
  return cell.text;
}

async function importRows(file: File): Promise<SourceRow[]> {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return csvRows(await file.text()).map((cells, index) => ({
      row: index + 1,
      cells,
    }));
  }
  if (!file.name.toLowerCase().endsWith(".xlsx"))
    throw new Error("Choose an Excel .xlsx file or a CSV file.");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const namedWorksheet = workbook.getWorksheet("Student Data");
  const worksheet =
    workbook.worksheets.find((candidate) => candidate === namedWorksheet) ?? workbook.worksheets[0];
  if (!worksheet) throw new Error("The Excel workbook does not contain a worksheet.");

  const rows: SourceRow[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const cells = Array.from({ length: row.cellCount }, (_, index) =>
      cellText(row.getCell(index + 1)),
    );
    if (cells.some(Boolean)) rows.push({ row: rowNumber, cells });
  });
  return rows;
}

function headerKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function catalogLabel(document: QueryDocumentSnapshot): string {
  const label: unknown = document.get("label");
  const name: unknown = document.get("name");
  const value = typeof label === "string" ? label : typeof name === "string" ? name : document.id;
  return value.trim();
}

function addFieldError(row: PreviewRow, column: string, message: string): void {
  if (row.fieldErrors.some((error) => error.column === column && error.message === message)) return;
  row.fieldErrors.push({ column, message });
  row.error = row.fieldErrors.map((error) => `${error.column}: ${error.message}`).join("; ");
}

function importValues(cells: string[], fieldIndexes: Map<string, number>): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of Object.keys(importFields)) {
    const column = fieldIndexes.get(field);
    values[field] = column === undefined ? "" : (cells[column] ?? "");
  }
  return values;
}

function validateCatalogRow(
  row: PreviewRow,
  activeClasses: Set<string>,
  activeSessions: Set<string>,
): void {
  const classValue = row.values.className ?? "";
  const validClass =
    activeClasses.has(classValue) && classValue.length > 0 && classValue === classValue.trim();
  if (!validClass)
    addFieldError(
      row,
      "className",
      activeClasses.size
        ? "Use an exact class name from the active Classes list."
        : "No active classes are configured. Add classes in the catalog first.",
    );
  const sessionValue = row.values.session ?? "";
  const validSession = /^\d{4}-\d{2}$/.test(sessionValue) && activeSessions.has(sessionValue);
  if (!validSession)
    addFieldError(
      row,
      "session",
      activeSessions.size
        ? "Use an active session in the exact YYYY-YY format shown in the template."
        : "No active sessions are configured. Add sessions in the catalog first.",
    );
}

function parseImportedStudent(row: PreviewRow): ImportData | null {
  const parsed = studentCreateSchema
    .omit({ certificateType: true, certificateNumber: true, issuedAt: true })
    .safeParse(row.values);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "file");
      addFieldError(row, fieldLabels[field] ?? field, issue.message);
    }
    return null;
  }
  return {
    studentName: parsed.data.studentName,
    fatherName: parsed.data.fatherName,
    motherName: parsed.data.motherName,
    className: parsed.data.className,
    scholarNumber: parsed.data.scholarNumber,
    session: parsed.data.session,
    admissionNumber: parsed.data.admissionNumber ?? "",
    dateOfBirth: parsed.data.dateOfBirth ?? "",
    admissionNo: parsed.data.admissionNo ?? "",
  };
}

async function validateExistingStudent(row: PreviewRow, data: ImportData): Promise<void> {
  const key = createSearchKey(data);
  const scholarKey = scholarLookupHmac(data.scholarNumber, data.className, data.session);
  const [existing, scholarMatches] = await Promise.all([
    db.collection("students").where("searchKey", "==", key).get(),
    db.collection("students").where("scholarLookupKey", "==", scholarKey).get(),
  ]);
  const hasDisambiguator = Boolean(data.dateOfBirth || data.admissionNumber || data.admissionNo);
  const existingNeedsIdentity = existing.docs.some(
    (doc) =>
      !doc.get("dateOfBirthDisambiguationKey") && !doc.get("admissionNumberDisambiguationKey"),
  );
  if (scholarMatches.docs.some((doc) => doc.get("searchKey") !== key))
    addFieldError(
      row,
      "scholarNumber",
      "Already assigned to a different student in this class and session.",
    );
  if (!existing.empty && (!hasDisambiguator || existingNeedsIdentity))
    addFieldError(
      row,
      "studentName",
      "Duplicate name combination: add a date of birth or admission number.",
    );
}

async function previewImportRow(input: {
  source: SourceRow;
  headerLength: number;
  fieldIndexes: Map<string, number>;
  activeClasses: Set<string>;
  activeSessions: Set<string>;
}): Promise<PreviewRow> {
  const { source, headerLength, fieldIndexes, activeClasses, activeSessions } = input;
  const values = importValues(source.cells, fieldIndexes);
  const row: PreviewRow = { row: source.row, data: null, values, error: null, fieldErrors: [] };
  for (let index = headerLength; index < source.cells.length; index++)
    if (source.cells[index])
      addFieldError(row, `Column ${String(index + 1)}`, "Unexpected cell value.");
  validateCatalogRow(row, activeClasses, activeSessions);
  const data = parseImportedStudent(row);
  if (!data) return row;
  row.data = data;
  if (!row.error) await validateExistingStudent(row, data);
  return row;
}

function groupValidRows(
  preview: PreviewRow[],
  keyOf: (data: ImportData) => string,
): Map<string, PreviewRow[]> {
  const groups = new Map<string, PreviewRow[]>();
  for (const row of preview) {
    if (!row.data) continue;
    const key = keyOf(row.data);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return groups;
}

function markDuplicateNames(preview: PreviewRow[]): void {
  const groups = groupValidRows(preview, createSearchKey);
  for (const group of groups.values()) markDuplicateNameGroup(group);
}

function markDuplicateNameGroup(group: PreviewRow[]): void {
  if (group.length < 2) return;
  for (const row of group) {
    const data = row.data;
    if (data && !data.dateOfBirth && !data.admissionNumber && !data.admissionNo)
      addFieldError(
        row,
        "studentName",
        "Duplicate name combination: add a date of birth or admission number.",
      );
  }
}

function markDuplicateScholars(preview: PreviewRow[]): void {
  const groups = groupValidRows(preview, (data) =>
    scholarLookupHmac(data.scholarNumber, data.className, data.session),
  );
  for (const group of groups.values()) markDuplicateScholarGroup(group);
}

function markDuplicateScholarGroup(group: PreviewRow[]): void {
  if (group.length < 2) return;
  for (const row of group)
    addFieldError(row, "scholarNumber", "Repeated in this file for the same class and session.");
}

async function loadCommitMatches(data: ImportData) {
  const key = createSearchKey(data);
  const scholarKey = scholarLookupHmac(data.scholarNumber, data.className, data.session);
  const [matches, scholarMatches] = await Promise.all([
    db.collection("students").where("searchKey", "==", key).get(),
    db.collection("students").where("scholarLookupKey", "==", scholarKey).get(),
  ]);
  return { key, scholarKey, matches, scholarMatches };
}

function importIdentityKeys(data: ImportData) {
  const dateOfBirth = data.dateOfBirth || "";
  const admission = data.admissionNumber || data.admissionNo || "";
  return {
    dateOfBirth,
    admission,
    dateOfBirthKey: dateOfBirth ? studentIdentifierHmac(dateOfBirth) : "",
    admissionKey: admission ? studentIdentifierHmac(admission) : "",
  };
}

function assertNoImportConflict(input: {
  rowNumber: number;
  key: string;
  matches: FirebaseFirestore.QuerySnapshot;
  scholarMatches: FirebaseFirestore.QuerySnapshot;
  dateOfBirthKey: string;
  admissionKey: string;
}): void {
  const { rowNumber, key, matches, scholarMatches, dateOfBirthKey, admissionKey } = input;
  if (scholarMatches.docs.some((doc) => doc.get("searchKey") !== key))
    throw new Error(
      `Scholar number on import row ${String(rowNumber)} is already assigned in this class and session.`,
    );
  const existingNeedsIdentity = matches.docs.some(
    (doc) =>
      !doc.get("dateOfBirthDisambiguationKey") && !doc.get("admissionNumberDisambiguationKey"),
  );
  if (!matches.empty && ((!dateOfBirthKey && !admissionKey) || existingNeedsIdentity))
    throw new Error(
      `Duplicate name combination detected on import row ${String(rowNumber)}: add a date of birth or admission number so students can be told apart.`,
    );
}

function importedStudentFields(
  data: ImportData,
  key: string,
  scholarKey: string,
  identity: ReturnType<typeof importIdentityKeys>,
) {
  return {
    studentName: data.studentName,
    fatherName: data.fatherName,
    motherName: data.motherName,
    className: data.className,
    scholarNumber: encryptStudentIdentifier(data.scholarNumber),
    scholarLookupKey: scholarKey,
    session: data.session,
    searchKey: key,
    ...(identity.dateOfBirth
      ? {
          dateOfBirth: encryptStudentIdentifier(identity.dateOfBirth),
          dateOfBirthDisambiguationKey: identity.dateOfBirthKey,
        }
      : {}),
    ...(identity.admission
      ? {
          admissionNumber: encryptStudentIdentifier(identity.admission),
          admissionNumberDisambiguationKey: identity.admissionKey,
        }
      : {}),
  };
}

async function persistImportedStudent(input: {
  request: NextRequest;
  adminUid: string;
  identified: QueryDocumentSnapshot[];
  fields: ReturnType<typeof importedStudentFields>;
}): Promise<"created" | "updated"> {
  const { request, adminUid, identified, fields } = input;
  const existing = identified.at(0);
  if (existing) {
    await existing.ref.update({
      ...fields,
      importedFromExcel: true,
      ...(fields.admissionNumber ? { admissionNo: FieldValue.delete() } : {}),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: adminUid,
    });
    await writeAuditLog(request, adminUid, "student.update", existing.id, existing.id);
    return "updated";
  }
  const created = await db.collection("students").add({
    ...fields,
    importedFromExcel: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: adminUid,
  });
  await writeAuditLog(request, adminUid, "student.create", created.id, created.id);
  return "created";
}

async function commitImportRow(
  request: NextRequest,
  adminUid: string,
  item: PreviewRow,
): Promise<"created" | "updated" | null> {
  const data = item.data;
  if (!data) return null;
  const { key, scholarKey, matches, scholarMatches } = await loadCommitMatches(data);
  const identity = importIdentityKeys(data);
  assertNoImportConflict({
    rowNumber: item.row,
    key,
    matches,
    scholarMatches,
    dateOfBirthKey: identity.dateOfBirthKey,
    admissionKey: identity.admissionKey,
  });
  const identified = matches.docs.filter((doc) =>
    studentIdentityMatches(doc.data(), identity.dateOfBirthKey, identity.admissionKey),
  );
  if (identified.length > 1)
    throw new Error(`Import row ${String(item.row)} matches multiple existing students.`);
  const fields = importedStudentFields(data, key, scholarKey, identity);
  return persistImportedStudent({ request, adminUid, identified, fields });
}

function resolveHeaderIndexes(headerRow: SourceRow): Map<string, number> | NextResponse {
  const headers = headerRow.cells.map(headerKey);
  const headerErrors: string[] = [];
  const fieldIndexes = new Map<string, number>();
  for (const [field, acceptedHeaders] of Object.entries(importFields)) {
    const accepted = new Set<string>(acceptedHeaders);
    const positions = headers
      .map((header, index) => (accepted.has(header) ? index : -1))
      .filter((index) => index >= 0);
    if (positions.length > 1)
      headerErrors.push(`Use only one column for ${String(fieldLabels[field])}.`);
    if (positions[0] !== undefined) fieldIndexes.set(field, positions[0]);
  }
  for (const field of requiredFields) {
    if (!fieldIndexes.has(field))
      headerErrors.push(`Missing required column: ${String(fieldLabels[field])}.`);
  }
  const knownHeaders = new Set<string>(
    Object.values(importFields).flatMap((values) => [...values]),
  );
  for (const [index, header] of headers.entries()) {
    if (header && !knownHeaders.has(header))
      headerErrors.push(`Unexpected column "${String(headerRow.cells[index])}".`);
  }
  if (headerErrors.length)
    return NextResponse.json(
      { error: `Fix the Excel header row ${String(headerRow.row)}: ${headerErrors.join(" ")}` },
      { status: 400 },
    );
  return fieldIndexes;
}

async function activeCatalogs(): Promise<{ classes: Set<string>; sessions: Set<string> }> {
  const [classesSnapshot, sessionsSnapshot] = await Promise.all([
    db.collection("classes").get(),
    db.collection("sessions").get(),
  ]);
  return {
    classes: new Set(
      classesSnapshot.docs
        .filter((doc) => doc.get("isActive") !== false)
        .map(catalogLabel)
        .filter(Boolean),
    ),
    sessions: new Set(
      sessionsSnapshot.docs
        .filter((doc) => doc.get("isActive") !== false)
        .map((doc) => normalizeAcademicSession(catalogLabel(doc)) ?? "")
        .filter(Boolean),
    ),
  };
}

async function buildImportPreview(
  rows: SourceRow[],
  headerRow: SourceRow,
  fieldIndexes: Map<string, number>,
  catalogs: { classes: Set<string>; sessions: Set<string> },
): Promise<PreviewRow[]> {
  const preview = await Promise.all(
    rows.slice(1).map((source) =>
      previewImportRow({
        source,
        headerLength: headerRow.cells.length,
        fieldIndexes,
        activeClasses: catalogs.classes,
        activeSessions: catalogs.sessions,
      }),
    ),
  );
  markDuplicateNames(preview);
  markDuplicateScholars(preview);
  return preview;
}

function invalidRowCount(rows: SourceRow[]): NextResponse | null {
  if (rows.length < 2)
    return NextResponse.json(
      { error: "The file needs a header row and at least one student row." },
      { status: 400 },
    );
  if (rows.length - 1 > MAX_CSV_ROWS)
    return NextResponse.json(
      { error: `Import no more than ${String(MAX_CSV_ROWS)} student rows at a time.` },
      { status: 400 },
    );
  return null;
}

function previewResponse(preview: PreviewRow[]): NextResponse {
  const errors = preview.filter((row) => row.error);
  return NextResponse.json(
    {
      total: preview.length,
      valid: preview.length - errors.length,
      errors,
      preview: preview.slice(0, 500),
    },
    { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
  );
}

async function commitPreview(
  request: NextRequest,
  adminUid: string,
  preview: PreviewRow[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  for (const item of preview) {
    const result = await commitImportRow(request, adminUid, item);
    if (result === "created") created++;
    if (result === "updated") updated++;
  }
  await writeAuditLog(request, adminUid, "student.bulk_import", String(preview.length));
  return { created, updated };
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["uploader", "admin", "superadmin"]);
    const tooLarge = rejectOversizedRequest(request, MAX_CSV_BYTES);
    if (tooLarge) return tooLarge;
    const form = await request.formData();
    const action = formString(form, "action", "preview");
    if (!isImportAction(action))
      return NextResponse.json({ error: "Choose preview or commit." }, { status: 400 });
    const file = importFile(form.get("file"));
    if (file instanceof NextResponse) return file;
    const quotaError = await consumeAdminUploadQuota(admin.uid, file.size);
    if (quotaError) return NextResponse.json({ error: quotaError }, { status: 429 });
    const rows = await importRows(file);
    const rowCountError = invalidRowCount(rows);
    if (rowCountError) return rowCountError;
    const headerRow = rows.at(0);
    if (!headerRow)
      return NextResponse.json({ error: "The file needs a header row." }, { status: 400 });
    const fieldIndexes = resolveHeaderIndexes(headerRow);
    if (fieldIndexes instanceof NextResponse) return fieldIndexes;
    const catalogs = await activeCatalogs();
    const preview = await buildImportPreview(rows, headerRow, fieldIndexes, catalogs);
    const errors = preview.filter((row) => row.error);
    if (action === "preview") return previewResponse(preview);
    if (errors.length)
      return NextResponse.json(
        { error: "Resolve every invalid row before committing.", total: preview.length, errors },
        { status: 400 },
      );
    const result = await commitPreview(request, admin.uid, preview);
    return NextResponse.json(
      { ok: true, total: preview.length, ...result },
      { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

function isImportAction(action: string): action is "preview" | "commit" {
  return action === "preview" || action === "commit";
}

function importFile(value: FormDataEntryValue | null): File | NextResponse {
  if (value instanceof File && value.size <= MAX_CSV_BYTES) return value;
  return NextResponse.json(
    { error: "Upload an Excel .xlsx or CSV file no larger than 2 MB." },
    { status: 400 },
  );
}
