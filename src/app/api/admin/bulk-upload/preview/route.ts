import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { certificateTypeSlug } from "@/server/r2";
import {
  requireRoles,
  apiError,
  createCertificateNumberHash,
} from "@/server/security";
import { studentIdentifierHmac } from "@/server/student-pii";
import { normalizeAcademicSession } from "@/shared/academic-session";

import type { NextRequest} from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function safeTypeSlug(value: string): string {
  try {
    return certificateTypeSlug(value);
  } catch {
    return "";
  }
}
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows.filter((item) => !item[0]?.startsWith("#"));
}
export async function POST(request: NextRequest) {
  try {
    await requireRoles(request, ["uploader", "admin"]);
    const form = await request.formData();
    const csv = form.get("mappingCsv");
    if (!(csv instanceof File) || csv.size > 2 * 1024 * 1024)
      return NextResponse.json(
        { error: "Provide a mapping CSV smaller than 2 MB." },
        { status: 400 },
      );
    let files: { name: string; size: number }[] = [];
    try {
      files = JSON.parse(String(form.get("fileManifest") ?? "[]")) as {
        name: string;
        size: number;
      }[];
    } catch {
      return NextResponse.json(
        { error: "File manifest is invalid." },
        { status: 400 },
      );
    }
    if (
      !Array.isArray(files) ||
      files.length < 1 ||
      files.length > 20 ||
      files.some(
        (f) => typeof f?.name !== "string" || typeof f?.size !== "number",
      )
    )
      return NextResponse.json(
        { error: "Provide between 1 and 20 files." },
        { status: 400 },
      );
    const rows = parseCsv(await csv.text());
    if (rows.length < 2)
      return NextResponse.json(
        { error: "Mapping CSV needs headers and at least one row." },
        { status: 400 },
      );
    const headers = rows[0]!.map((x) => x.toLowerCase().replace(/\s+/g, ""));
    const values = rows
      .slice(1)
      .map((c) => Object.fromEntries(headers.map((h, i) => [h, c[i] ?? ""])));
    const preview = [];
    const seenNumbers = new Set<string>();
    for (const file of files) {
      const pattern = /^([^_]+)_(.+)\.(pdf|jpe?g|png)$/i.exec(file.name);
      const row = values.find(
        (v) =>
          String(v.filename ?? v.file ?? "") === file.name ||
          (pattern &&
            String(v.admissionnumber ?? v.admissionno ?? "") === pattern[1] &&
            ((!v.certificatetype && !v.type) ||
              safeTypeSlug(String(v.certificatetype ?? v.type)) ===
                safeTypeSlug(pattern[2]!.replace(/[-_]+/g, " ")))),
      );
      const errors: string[] = [];
      if (!row) errors.push("No mapping row for this filename.");
      if (file.size <= 0 || file.size > 5 * 1024 * 1024)
        errors.push("File must be 1 byte to 5 MB.");
      if (!/\.(pdf|jpe?g|png)$/i.test(file.name))
        errors.push("File extension must be PDF, JPG or PNG.");
      if (row) {
        const session = String(row.session ?? "");
        const filePattern = /^([^_]+)_(.+)\.(pdf|jpe?g|png)$/i.exec(file.name);
        const inferredAdmission = filePattern?.[1] ?? "";
        const inferredType = (filePattern?.[2] ?? "").replace(/[-_]+/g, " ");
        const type = String(row.certificatetype ?? row.type ?? inferredType);
        const number = String(row.certificatenumber ?? "");
        const date = String(row.issuedate ?? "");
        const admissionNo = String(
          row.admissionnumber ?? row.admissionno ?? inferredAdmission,
        );
        if (!/^\d{4}-\d{2}$/.test(session)) errors.push("Invalid session.");
        if (type.length < 2)
          errors.push(
            "Certificate type is required (or use admissionNo_type.pdf naming). ",
          );
        if (!number) errors.push("Certificate number is required.");
        else {
          const hash = createCertificateNumberHash(number);
          if (seenNumbers.has(hash))
            errors.push("Duplicate certificate number in this batch.");
          seenNumbers.add(hash);
          const existing = await db
            .collection("certificateNumberIndex")
            .doc(hash)
            .get();
          if (existing.exists)
            errors.push("Certificate number is already assigned.");
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
          errors.push("Issue date must be YYYY-MM-DD.");
        let student = null;
        if (row.studentid)
          student = await db
            .collection("students")
            .doc(String(row.studentid))
            .get();
        else if (admissionNo) {
          const admissionKey = studentIdentifierHmac(admissionNo);
          let s = await db
            .collection("students")
            .where("admissionNumberDisambiguationKey", "==", admissionKey)
            .limit(2)
            .get();
          if (!s.size)
            s = await db
              .collection("students")
              .where("admissionNo", "==", admissionNo)
              .limit(2)
              .get();
          if (s.size === 1) student = s.docs[0]!;
        }
        if (!student?.exists)
          errors.push(
            "Student/admission number did not match exactly one student.",
          );
        else if (
          normalizeAcademicSession(String(student.get("session") ?? "")) !==
          normalizeAcademicSession(session)
        )
          errors.push("Certificate session must match the student's passing session.");
        if (/^\d{4}-\d{2}$/.test(session)) {
          const sessionDoc = await db.collection("sessions").doc(session).get();
          if (!sessionDoc.exists || sessionDoc.get("isActive") === false)
            errors.push("Session is not configured/active.");
        }
        if (type.length >= 2) {
          const typeSlug = safeTypeSlug(type);
          if (!typeSlug) errors.push("Certificate type is invalid.");
          else {
            const typeDoc = await db
              .collection("certificateTypes")
              .doc(typeSlug)
              .get();
            if (!typeDoc.exists)
              errors.push("Certificate type is not configured.");
          }
        }
      }
      preview.push({
        fileName: file.name,
        size: file.size,
        valid: errors.length === 0,
        errors,
        mapping: row
          ? {
              fileName: file.name,
              admissionNo: String(
                row.admissionnumber ??
                  row.admissionno ??
                  (/^([^_]+)_(.+)\.(pdf|jpe?g|png)$/i.exec(file.name))?.[1] ??
                  "",
              ),
              studentId: String(row.studentid ?? ""),
              session: String(row.session ?? ""),
              certificateType: String(
                row.certificatetype ??
                  row.type ??
                  (
                    (/^([^_]+)_(.+)\.(pdf|jpe?g|png)$/i.exec(file.name))?.[2] ??
                    ""
                  ).replace(/[-_]+/g, " "),
              ),
              certificateNumber: String(row.certificatenumber ?? ""),
              issueDate: String(row.issuedate ?? ""),
            }
          : null,
      });
    }
    return NextResponse.json(
      {
        total: preview.length,
        valid: preview.filter((x) => x.valid).length,
        preview,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
