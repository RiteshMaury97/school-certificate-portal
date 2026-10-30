import { NextRequest, NextResponse } from "next/server";
import { db } from "@/src/lib/firebase-admin";
import {
  createSearchKey,
  requireRoles,
  writeAuditLog,
  apiError,
} from "@/src/lib/security";
import { studentCreateSchema } from "@/src/lib/validation";
import { FieldValue } from "firebase-admin/firestore";
import { retentionExpiryFromSession } from "@/src/lib/retention-policy";
import {
  encryptStudentIdentifier,
  studentIdentifierHmac,
  studentIdentityMatches,
} from "@/src/lib/student-pii";
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
export async function POST(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["uploader"]);
    const form = await request.formData();
    const file = form.get("file");
    const action = String(form.get("action") ?? "preview");
    if (!(file instanceof File) || file.size > 2 * 1024 * 1024)
      return NextResponse.json(
        { error: "Upload a CSV smaller than 2 MB." },
        { status: 400 },
      );
    const rows = csvRows(await file.text());
    if (rows.length < 2)
      return NextResponse.json(
        { error: "CSV needs a header and at least one row." },
        { status: 400 },
      );
    const headers = rows[0]!.map((v) => v.toLowerCase().replace(/\s+/g, ""));
    const required = ["studentname", "fathername", "mothername", "session"];
    if (required.some((k) => !headers.includes(k)))
      return NextResponse.json(
        {
          error: "Required columns: studentName,fatherName,motherName,session",
        },
        { status: 400 },
      );
    const preview = await Promise.all(
      rows.slice(1).map(async (cells, index) => {
        const item = Object.fromEntries(
          headers.map((h, i) => [h, cells[i] ?? ""]),
        );
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
            session: item.session,
          });
        if (!parsed.success)
          return {
            row: index + 2,
            data: null,
            error: parsed.error.issues.map((i) => i.message).join("; "),
          };
        const key = createSearchKey(parsed.data);
        const existing = await db
          .collection("students")
          .where("searchKey", "==", key)
          .get();
        const hasDisambiguator = Boolean(
          parsed.data.dateOfBirth ||
          parsed.data.admissionNumber ||
          parsed.data.admissionNo,
        );
        const existingNeedsIdentity = existing.docs.some(
          (doc) =>
            !doc.get("dateOfBirthDisambiguationKey") &&
            !doc.get("admissionNumberDisambiguationKey"),
        );
        return {
          row: index + 2,
          data: parsed.data,
          error:
            !existing.empty && (!hasDisambiguator || existingNeedsIdentity)
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
          if (
            row.data &&
            !row.data.dateOfBirth &&
            !row.data.admissionNumber &&
            !row.data.admissionNo
          )
            row.error =
              "Duplicate name combination detected: add a date of birth or admission number so students can be told apart.";
        }
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
      const matches = await db
        .collection("students")
        .where("searchKey", "==", key)
        .get();
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
          `Duplicate name combination detected on CSV row ${item.row}: add a date of birth or admission number so students can be told apart.`,
        );
      const identified = matches.docs.filter((doc) =>
        studentIdentityMatches(doc.data(), dobKey, admissionKey),
      );
      if (identified.length > 1)
        throw new Error(
          `CSV row ${item.row} matches multiple existing students.`,
        );
      const retentionExpiresAt = retentionExpiryFromSession(
        data.session,
        retentionYears,
      );
      if (!retentionExpiresAt)
        throw new Error(`Invalid academic session on CSV row ${item.row}.`);
      const common = {
        studentName: data.studentName,
        fatherName: data.fatherName,
        motherName: data.motherName,
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
