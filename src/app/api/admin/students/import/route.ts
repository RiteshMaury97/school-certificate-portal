import ExcelJS from "exceljs";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import {
  createSearchKey,
  requireRoles,
  writeAuditLog,
  apiError,
} from "@/server/security";
import {
  encryptStudentIdentifier,
  scholarLookupHmac,
  studentIdentifierHmac,
  studentIdentityMatches,
} from "@/server/student-pii";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { retentionExpiryFromSession } from "@/shared/retention-policy";
import { studentCreateSchema } from "@/shared/validation";

import type { Cell } from "exceljs";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
export const runtime = "nodejs";
const maxImportRows = 500;
const maxImportSize = 5 * 1024 * 1024;
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
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows.filter((item) => !item[0]?.startsWith("#"));
}

function cellText(cell: Cell): string {
  if (cell.value instanceof Date) return cell.value.toISOString().slice(0, 10);
  if (
    typeof cell.value === "object" &&
    cell.value !== null &&
    "formula" in cell.value
  )
    return "";
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
  const worksheet =
    workbook.getWorksheet("Student Data") ?? workbook.worksheets[0];
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
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function catalogLabel(
  document: QueryDocumentSnapshot,
): string {
  const label = document.get("label");
  const name = document.get("name");
  return String(label ?? name ?? document.id).trim();
}

function addFieldError(
  row: PreviewRow,
  column: string,
  message: string,
): void {
  if (
    row.fieldErrors.some(
      (error) => error.column === column && error.message === message,
    )
  )
    return;
  row.fieldErrors.push({ column, message });
  row.error = row.fieldErrors
    .map((error) => `${error.column}: ${error.message}`)
    .join("; ");
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["uploader", "admin", "superadmin"]);
    const form = await request.formData();
    const file = form.get("file");
    const action = String(form.get("action") ?? "preview");
    if (action !== "preview" && action !== "commit")
      return NextResponse.json({ error: "Choose preview or commit." }, { status: 400 });
    if (!(file instanceof File) || file.size > maxImportSize)
      return NextResponse.json(
        { error: "Upload an Excel .xlsx or CSV file smaller than 5 MB." },
        { status: 400 },
      );
    const rows = await importRows(file);
    if (rows.length < 2)
      return NextResponse.json(
        { error: "The file needs a header row and at least one student row." },
        { status: 400 },
      );
    if (rows.length - 1 > maxImportRows)
      return NextResponse.json(
        { error: `Import no more than ${maxImportRows} student rows at a time.` },
        { status: 400 },
      );

    const headerRow = rows[0]!;
    const headers = headerRow.cells.map(headerKey);
    const headerErrors: string[] = [];
    const fieldIndexes = new Map<string, number>();
    for (const [field, acceptedHeaders] of Object.entries(importFields)) {
      const accepted = new Set<string>(acceptedHeaders);
      const positions = headers
        .map((header, index) => (accepted.has(header) ? index : -1))
        .filter((index) => index >= 0);
      if (positions.length > 1)
        headerErrors.push(`Use only one column for ${fieldLabels[field]}.`);
      if (positions[0] !== undefined) fieldIndexes.set(field, positions[0]);
    }
    for (const field of requiredFields)
      if (!fieldIndexes.has(field))
        headerErrors.push(`Missing required column: ${fieldLabels[field]}.`);
    const knownHeaders = new Set<string>(
      Object.values(importFields).flatMap((values) => [...values]),
    );
    for (const [index, header] of headers.entries())
      if (header && !knownHeaders.has(header))
        headerErrors.push(`Unexpected column "${headerRow.cells[index]}".`);
    if (headerErrors.length)
      return NextResponse.json(
        {
          error: `Fix the Excel header row ${headerRow.row}: ${headerErrors.join(" ")}`,
        },
        { status: 400 },
      );

    const [classesSnapshot, sessionsSnapshot] = await Promise.all([
      db.collection("classes").get(),
      db.collection("sessions").get(),
    ]);
    const activeClasses = new Set(
      classesSnapshot.docs
        .filter((document) => document.get("isActive") !== false)
        .map(catalogLabel)
        .filter(Boolean),
    );
    const activeSessions = new Set(
      sessionsSnapshot.docs
        .filter((document) => document.get("isActive") !== false)
        .map((document) => normalizeAcademicSession(catalogLabel(document)) ?? "")
        .filter(Boolean),
    );
    const preview: PreviewRow[] = await Promise.all(
      rows.slice(1).map(async ({ cells, row: sourceRow }) => {
        const values: Record<string, string> = {};
        for (const field of Object.keys(importFields)) {
          const column = fieldIndexes.get(field);
          values[field] = column === undefined ? "" : cells[column] ?? "";
        }
        const row: PreviewRow = {
          row: sourceRow,
          data: null,
          values,
          error: null,
          fieldErrors: [],
        };
        for (let index = headerRow.cells.length; index < cells.length; index++)
          if (cells[index])
            addFieldError(row, `Column ${index + 1}`, "Unexpected cell value.");

        const classValue = values.className ?? "";
        if (
          !activeClasses.has(classValue) ||
          !classValue ||
          classValue !== classValue.trim()
        )
          addFieldError(
            row,
            "className",
            activeClasses.size
              ? "Use an exact class name from the active Classes list."
              : "No active classes are configured. Add classes in the catalog first.",
          );
        const sessionValue = values.session ?? "";
        if (
          !/^\d{4}-\d{2}$/.test(sessionValue) ||
          !activeSessions.has(sessionValue)
        )
          addFieldError(
            row,
            "session",
            activeSessions.size
              ? "Use an active session in the exact YYYY-YY format shown in the template."
              : "No active sessions are configured. Add sessions in the catalog first.",
          );

        const parsed = studentCreateSchema
          .omit({
            certificateType: true,
            certificateNumber: true,
            issuedAt: true,
          })
          .safeParse({
            admissionNumber: values.admissionNumber,
            dateOfBirth: values.dateOfBirth,
            studentName: values.studentName,
            fatherName: values.fatherName,
            motherName: values.motherName,
            className: classValue,
            scholarNumber: values.scholarNumber,
            session: sessionValue,
          });
        if (!parsed.success) {
          for (const issue of parsed.error.issues) {
            const field = String(issue.path[0] ?? "file");
            addFieldError(
              row,
              fieldLabels[field] ?? field,
              issue.message,
            );
          }
          return row;
        }
        const importedData: ImportData = {
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
        row.data = importedData;
        if (row.error) return row;

        const key = createSearchKey(importedData);
        const scholarKey = scholarLookupHmac(
          importedData.scholarNumber,
          importedData.className,
          importedData.session,
        );
        const existing = await db
          .collection("students")
          .where("searchKey", "==", key)
          .get();
        const scholarMatches = await db
          .collection("students")
          .where("scholarLookupKey", "==", scholarKey)
          .get();
        const hasDisambiguator = Boolean(
          importedData.dateOfBirth ||
          importedData.admissionNumber ||
          importedData.admissionNo,
        );
        const existingNeedsIdentity = existing.docs.some(
          (doc) =>
            !doc.get("dateOfBirthDisambiguationKey") &&
            !doc.get("admissionNumberDisambiguationKey"),
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
        return row;
      }),
    );
    const duplicateGroups = new Map<string, PreviewRow[]>();
    for (const row of preview) {
      if (!row.data) continue;
      const key = createSearchKey(row.data);
      const group = duplicateGroups.get(key) ?? [];
      group.push(row);
      duplicateGroups.set(key, group);
    }
    for (const group of duplicateGroups.values())
      if (group.length > 1)
        for (const row of group) {
          if (
            row.data &&
            !row.data.dateOfBirth &&
            !row.data.admissionNumber &&
            !row.data.admissionNo
          )
            addFieldError(
              row,
              "studentName",
              "Duplicate name combination: add a date of birth or admission number.",
            );
        }
    const scholarGroups = new Map<string, PreviewRow[]>();
    for (const row of preview) {
      if (!row.data) continue;
      const key = scholarLookupHmac(
        row.data.scholarNumber,
        row.data.className,
        row.data.session,
      );
      const group = scholarGroups.get(key) ?? [];
      group.push(row);
      scholarGroups.set(key, group);
    }
    for (const group of scholarGroups.values())
      if (group.length > 1)
        for (const row of group)
          addFieldError(
            row,
            "scholarNumber",
            "Repeated in this file for the same class and session.",
          );
    const errors = preview.filter((r) => r.error);
    if (action !== "commit")
      return NextResponse.json(
        {
          total: preview.length,
          valid: preview.length - errors.length,
          errors,
          preview: preview.slice(0, 500),
        },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-Robots-Tag": "noindex, nofollow",
          },
        },
      );
    if (errors.length)
      return NextResponse.json(
        {
          error: "Resolve every invalid row before committing.",
          total: preview.length,
          errors,
        },
        { status: 400 },
      );
    let created = 0,
      updated = 0;
    const siteSettings = await db.collection("siteSettings").doc("main").get();
    const retentionYears = Math.max(
      1,
      Math.min(30, Number(siteSettings.get("retentionYears") ?? 7)),
    );
    for (const item of preview) {
      if (!item.data) continue;
      const data = item.data;
      const key = createSearchKey(data);
      const scholarKey = scholarLookupHmac(
        data.scholarNumber,
        data.className,
        data.session,
      );
      const matches = await db
        .collection("students")
        .where("searchKey", "==", key)
        .get();
      const scholarMatches = await db
        .collection("students")
        .where("scholarLookupKey", "==", scholarKey)
        .get();
      if (scholarMatches.docs.some((doc) => doc.get("searchKey") !== key))
        throw new Error(
          `Scholar number on import row ${item.row} is already assigned in this class and session.`,
        );
      const dob = data.dateOfBirth || "";
      const admission = data.admissionNumber || data.admissionNo || "";
      const dobKey = dob ? studentIdentifierHmac(dob) : "";
      const admissionKey = admission ? studentIdentifierHmac(admission) : "";
      if (
        !matches.empty &&
        ((!dobKey && !admissionKey) ||
          matches.docs.some(
            (doc) =>
              !doc.get("dateOfBirthDisambiguationKey") &&
              !doc.get("admissionNumberDisambiguationKey"),
          ))
      )
        throw new Error(
          `Duplicate name combination detected on import row ${item.row}: add a date of birth or admission number so students can be told apart.`,
        );
      const identified = matches.docs.filter((doc) =>
        studentIdentityMatches(doc.data(), dobKey, admissionKey),
      );
      if (identified.length > 1)
        throw new Error(
          `Import row ${item.row} matches multiple existing students.`,
        );
      const retentionExpiresAt = retentionExpiryFromSession(
        data.session,
        retentionYears,
      );
      if (!retentionExpiresAt)
        throw new Error(`Invalid academic session on import row ${item.row}.`);
      const common = {
        studentName: data.studentName,
        fatherName: data.fatherName,
        motherName: data.motherName,
        className: data.className,
        scholarNumber: encryptStudentIdentifier(data.scholarNumber),
        scholarLookupKey: scholarKey,
        session: data.session,
        searchKey: key,
        retentionExpiresAt,
        ...(dob
          ? {
              dateOfBirth: encryptStudentIdentifier(dob),
              dateOfBirthDisambiguationKey: dobKey,
            }
          : {}),
        ...(admission
          ? {
              admissionNumber: encryptStudentIdentifier(admission),
              admissionNumberDisambiguationKey: admissionKey,
            }
          : {}),
      };
      if (identified.length === 1) {
        const existing = identified[0]!;
        await existing.ref.update({
          ...common,
          importedFromExcel: true,
          ...(admission ? { admissionNo: FieldValue.delete() } : {}),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: admin.uid,
        });
        updated++;
        await writeAuditLog(
          request,
          admin.uid,
          "student.update",
          existing.id,
          existing.id,
        );
      } else {
        const createdRef = await db
          .collection("students")
          .add({
            ...common,
            importedFromExcel: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: admin.uid,
          });
        created++;
        await writeAuditLog(
          request,
          admin.uid,
          "student.create",
          createdRef.id,
          createdRef.id,
        );
      }
    }
    await writeAuditLog(
      request,
      admin.uid,
      "student.bulk_import",
      String(preview.length),
    );
    return NextResponse.json(
      { ok: true, total: preview.length, created, updated },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  } catch (e) {
    return apiError(e);
  }
}
