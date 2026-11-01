import ExcelJS from "exceljs";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { createSearchKey, requireRoles, writeAuditLog, apiError } from "@/server/security";
import {
  encryptStudentIdentifier,
  scholarLookupHmac,
  studentIdentifierHmac,
  studentIdentityMatches,
} from "@/server/student-pii";
import { rejectOversizedRequest, reserveUploadQuota } from "@/server/upload-guard";
import { normalizeAcademicSession } from "@/shared/academic-session";
import { MAX_CSV_BYTES, MAX_CSV_ROWS, UPLOAD_MAX_BYTES } from "@/shared/upload-limits";
import { studentCreateSchema } from "@/shared/validation";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
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
async function uploadedRows(file: File): Promise<string[][]> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) return csvRows(await file.text());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()) as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  return sheet
    .getSheetValues()
    .slice(1)
    .map((values) =>
      Array.isArray(values) ? values.slice(1).map((value) => String(value ?? "").trim()) : [],
    )
    .filter((row) => row.some(Boolean));
}
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["uploader", "admin"]);
    const tooLarge = rejectOversizedRequest(request, UPLOAD_MAX_BYTES);
    if (tooLarge) return tooLarge;
    const form = await request.formData();
    const file = form.get("file");
    const action = String(form.get("action") ?? "preview");
    if (
      !(file instanceof File) ||
      file.size > (file.name.toLowerCase().endsWith(".csv") ? MAX_CSV_BYTES : UPLOAD_MAX_BYTES)
    )
      return NextResponse.json(
        { error: "Upload an .xlsx spreadsheet up to 4 MB or CSV up to 2 MB." },
        { status: 400 },
      );
    const rows = await uploadedRows(file);
    if (rows.length > MAX_CSV_ROWS + 1)
      return NextResponse.json(
        { error: `Import up to ${MAX_CSV_ROWS} student rows at a time.` },
        { status: 400 },
      );
    await reserveUploadQuota(admin.uid, file.size);
    if (rows.length < 2)
      return NextResponse.json(
        { error: "Spreadsheet needs a header and at least one student row." },
        { status: 400 },
      );
    const headers = rows[0]!.map((v) => v.toLowerCase().replace(/\s+/g, ""));
    const required = [
      "studentname",
      "fathername",
      "mothername",
      "classname",
      "scholarnumber",
      "session",
    ];
    const missingHeaders = required.filter((key) => !headers.includes(key));
    if (missingHeaders.length)
      return NextResponse.json(
        {
          error: `Header row (row 1) is missing required column${missingHeaders.length === 1 ? "" : "s"}: ${missingHeaders.join(", ")}. Download the Excel demo to restore the exact column names.`,
        },
        { status: 400 },
      );
    const [classSnapshot, sessionSnapshot] = await Promise.all([
      db.collection("classes").limit(500).get(),
      db.collection("sessions").limit(500).get(),
    ]);
    const classNames = new Set(
      classSnapshot.docs
        .filter((doc) => doc.get("isActive") !== false)
        .map((doc) => String(doc.get("label") ?? doc.get("name") ?? doc.id).trim()),
    );
    const sessionNames = new Set(
      sessionSnapshot.docs
        .filter((doc) => doc.get("isActive") !== false)
        .map((doc) =>
          normalizeAcademicSession(String(doc.get("label") ?? doc.get("name") ?? doc.id)),
        )
        .filter((session): session is string => Boolean(session)),
    );
    const preview = await Promise.all(
      rows.slice(1).map(async (cells, index) => {
        const item = Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
        const parsed = studentCreateSchema
          .omit({
            certificateType: true,
            certificateNumber: true,
            issuedAt: true,
          })
          .safeParse({
            admissionNumber: item.admissionnumber ?? item.admissionno ?? "",
            dateOfBirth: item.dateofbirth ?? "",
            studentName: item.studentname,
            fatherName: item.fathername,
            motherName: item.mothername,
            className: item.classname,
            scholarNumber: item.scholarnumber,
            session: item.session,
          });
        const rawData = {
          scholarNumber: item.scholarnumber ?? "",
          className: item.classname ?? "",
          admissionNumber: item.admissionnumber ?? item.admissionno ?? "",
          dateOfBirth: item.dateofbirth ?? "",
          studentName: item.studentname ?? "",
          fatherName: item.fathername ?? "",
          motherName: item.mothername ?? "",
          session: item.session ?? "",
        };
        if (!parsed.success)
          return {
            row: index + 2,
            data: rawData,
            fieldErrors: parsed.error.issues.map((issue) => ({
              field: String(issue.path[0] ?? "row"),
              message: issue.message,
            })),
            error: parsed.error.issues.map((i) => i.message).join("; "),
          };
        const fieldErrors: { field: string; message: string }[] = [];
        if (!classNames.has(parsed.data.className))
          fieldErrors.push({
            field: "className",
            message: `Use an exact class name from School Catalog: ${[...classNames].join(", ") || "no classes configured"}.`,
          });
        if (!/^\d{4}-\d{2}$/.test(parsed.data.session) || !sessionNames.has(parsed.data.session))
          fieldErrors.push({
            field: "session",
            message: `Use an active session exactly as listed in School Catalog: ${[...sessionNames].join(", ") || "no sessions configured"}.`,
          });
        if (fieldErrors.length)
          return {
            row: index + 2,
            data: parsed.data,
            fieldErrors,
            error: fieldErrors.map((entry) => entry.message).join("; "),
          };
        const key = createSearchKey(parsed.data);
        const scholarKey = scholarLookupHmac(
          parsed.data.scholarNumber,
          parsed.data.className,
          parsed.data.session,
        );
        const existing = await db.collection("students").where("searchKey", "==", key).get();
        const scholarMatches = await db
          .collection("students")
          .where("scholarLookupKey", "==", scholarKey)
          .get();
        const hasDisambiguator = Boolean(parsed.data.dateOfBirth || parsed.data.admissionNumber);
        const existingNeedsIdentity = existing.docs.some(
          (doc) =>
            !doc.get("dateOfBirthDisambiguationKey") &&
            !doc.get("admissionNumberDisambiguationKey"),
        );
        return {
          row: index + 2,
          data: parsed.data,
          fieldErrors: [],
          error: scholarMatches.docs.some((doc) => doc.get("searchKey") !== key)
            ? "Scholar number is already assigned to a different student in this class and session."
            : !existing.empty && (!hasDisambiguator || existingNeedsIdentity)
              ? "Duplicate name combination detected: add a date of birth or admission number so students can be told apart."
              : null,
        };
      }),
    );
    const duplicateGroups = new Map<string, typeof preview>();
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
          if (row.data && !row.data.dateOfBirth && !row.data.admissionNumber)
            row.error =
              "Duplicate name combination detected: add a date of birth or admission number so students can be told apart.";
        }
    const scholarGroups = new Map<string, typeof preview>();
    for (const row of preview) {
      if (!row.data) continue;
      const key = scholarLookupHmac(row.data.scholarNumber, row.data.className, row.data.session);
      const group = scholarGroups.get(key) ?? [];
      group.push(row);
      scholarGroups.set(key, group);
    }
    for (const group of scholarGroups.values())
      if (group.length > 1)
        for (const row of group)
          row.error = "Scholar number is repeated in this class and session.";
    const errors = preview.filter((r) => r.error);
    if (action !== "commit")
      return NextResponse.json(
        {
          total: preview.length,
          valid: preview.length - errors.length,
          errors,
          preview,
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
    const importedStudentIds = new Map<number, string>();
    for (const item of preview) {
      if (!item.data) continue;
      const data = item.data;
      const key = createSearchKey(data);
      const scholarKey = scholarLookupHmac(data.scholarNumber, data.className, data.session);
      const matches = await db.collection("students").where("searchKey", "==", key).get();
      const scholarMatches = await db
        .collection("students")
        .where("scholarLookupKey", "==", scholarKey)
        .get();
      if (scholarMatches.docs.some((doc) => doc.get("searchKey") !== key))
        throw new Error(
          `Scholar number on CSV row ${item.row} is already assigned in this class and session.`,
        );
      const dob = data.dateOfBirth || "";
      const admission = data.admissionNumber || "";
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
          `Duplicate name combination detected on CSV row ${item.row}: add a date of birth or admission number so students can be told apart.`,
        );
      const identified = matches.docs.filter((doc) =>
        studentIdentityMatches(doc.data(), dobKey, admissionKey),
      );
      if (identified.length > 1)
        throw new Error(`CSV row ${item.row} matches multiple existing students.`);
      const common = {
        studentName: data.studentName,
        fatherName: data.fatherName,
        motherName: data.motherName,
        className: data.className,
        scholarNumber: encryptStudentIdentifier(data.scholarNumber),
        scholarLookupKey: scholarKey,
        session: data.session,
        searchKey: key,
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
          ...(admission ? { admissionNo: FieldValue.delete() } : {}),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: admin.uid,
        });
        updated++;
        importedStudentIds.set(item.row, existing.id);
        await writeAuditLog(request, admin.uid, "student.update", existing.id, existing.id);
      } else {
        const createdRef = await db.collection("students").add({
          ...common,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: admin.uid,
        });
        created++;
        importedStudentIds.set(item.row, createdRef.id);
        await writeAuditLog(request, admin.uid, "student.create", createdRef.id, createdRef.id);
      }
    }
    await writeAuditLog(request, admin.uid, "student.bulk_import", String(preview.length));
    return NextResponse.json(
      {
        ok: true,
        total: preview.length,
        valid: preview.length,
        created,
        updated,
        preview: preview.map((row) => ({
          ...row,
          studentId: importedStudentIds.get(row.row) ?? "",
        })),
      },
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
