import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { requireRoles, apiError } from "@/server/security";
import { normalizeAcademicSession } from "@/shared/academic-session";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = [
  "scholarNumber",
  "className",
  "admissionNumber",
  "dateOfBirth",
  "studentName",
  "fatherName",
  "motherName",
  "session",
];
const sample = [
  "SCH-2023-001",
  "Choose from Allowed Values",
  "ADM-2023-001",
  "2010-04-15",
  "Rahul Kumar",
  "Amit Kumar",
  "Sunita Kumar",
  "Choose from Allowed Values",
];
export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["uploader", "admin"]);
    const format = request.nextUrl.searchParams.get("format") ?? "csv";
    if (format === "csv") {
      const csv =
        [
          headers.join(","),
          sample.map((v) => `"${v.replace(/"/g, '""')}"`).join(","),
          "# Required: scholarNumber, className, studentName, fatherName, motherName and session.",
          "# Use the exact spelling in school records; session format is YYYY-YY, e.g. 2023-24.",
          "# admissionNumber and dateOfBirth are optional; include them to distinguish duplicate names.",
        ].join("\r\n") + "\r\n";
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="student-import-template.csv"',
          "Cache-Control": "no-store",
        },
      });
    }
    if (format !== "xlsx")
      return NextResponse.json({ error: "Choose csv or xlsx." }, { status: 400 });
    const workbook = new ExcelJS.Workbook();
    const [classes, sessions] = await Promise.all([
      db.collection("classes").limit(200).get(),
      db.collection("sessions").limit(200).get(),
    ]);
    const classNames = classes.docs
      .filter((doc) => doc.get("isActive") !== false)
      .map((doc) => String(doc.get("label") ?? doc.get("name") ?? doc.id))
      .sort();
    const sessionNames = [
      ...new Set(
        sessions.docs
          .filter((doc) => doc.get("isActive") !== false)
          .map((doc) =>
            normalizeAcademicSession(String(doc.get("label") ?? doc.get("name") ?? doc.id)),
          )
          .filter((session): session is string => Boolean(session)),
      ),
    ].sort();
    const sheet = workbook.addWorksheet("Import Template");
    const validations = (
      sheet as ExcelJS.Worksheet & {
        dataValidations: { add: (range: string, rule: Record<string, unknown>) => void };
      }
    ).dataValidations;
    sheet.addRow(headers);
    sheet.addRow(sample);
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: "H1" };
    sheet.getRow(2).values = [
      sample[0],
      classNames[0] ?? "",
      sample[2],
      sample[3],
      sample[4],
      sample[5],
      sample[6],
      sessionNames[0] ?? "",
    ];
    if (classNames.length)
      validations.add("B2:B501", {
        type: "list",
        allowBlank: false,
        formulae: ["=AllowedClasses"],
        showErrorMessage: true,
        errorTitle: "Invalid class",
        error: "Choose an exact class from the Allowed Values sheet.",
      });
    if (sessionNames.length)
      validations.add("H2:H501", {
        type: "list",
        allowBlank: false,
        formulae: ["=AllowedSessions"],
        showErrorMessage: true,
        errorTitle: "Invalid session",
        error: "Choose an exact session from the Allowed Values sheet.",
      });
    sheet.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: Math.max(18, h.length + 4),
    }));
    const notes = workbook.addWorksheet("Validation Notes");
    notes.addRows([
      ["Column", "Required", "Validation"],
      ["scholarNumber", "Required", "Unique within class and session."],
      [
        "className",
        "Required",
        "Exact active class label from Allowed Values; use the dropdown. Do not invent or reformat it.",
      ],
      ["admissionNumber", "Optional", "Stored encrypted; used to distinguish duplicate names."],
      [
        "dateOfBirth",
        "Optional",
        "YYYY-MM-DD; stored encrypted and used to distinguish duplicate names.",
      ],
      [
        "studentName/fatherName/motherName",
        "Required for student matching",
        "Use the exact spelling in school records.",
      ],
      [
        "session",
        "Required",
        "Exact active session from Allowed Values; format YYYY-YY, e.g. 2023-24.",
      ],
    ]);
    notes.columns = [{ width: 28 }, { width: 24 }, { width: 90 }];
    notes.addRow([]);
    notes.addRow([
      "Demo row",
      "",
      "Replace this row with real student data; do not change column headers.",
    ]);
    notes.addRow([
      "Required columns",
      "",
      "scholarNumber, className, studentName, fatherName, motherName, session",
    ]);
    notes.addRow(["Optional columns", "", "admissionNumber and dateOfBirth (YYYY-MM-DD)"]);
    const allowed = workbook.addWorksheet("Allowed Values");
    allowed.addRow(["Class names", "Active sessions"]);
    const count = Math.max(classNames.length, sessionNames.length);
    for (let index = 0; index < count; index++)
      allowed.addRow([classNames[index] ?? "", sessionNames[index] ?? ""]);
    allowed.getRow(1).font = { bold: true };
    allowed.columns = [{ width: 36 }, { width: 24 }];
    if (classNames.length)
      workbook.definedNames.add(
        `'Allowed Values'!$A$2:$A$${classNames.length + 1}`,
        "AllowedClasses",
      );
    if (sessionNames.length)
      workbook.definedNames.add(
        `'Allowed Values'!$B$2:$B$${sessionNames.length + 1}`,
        "AllowedSessions",
      );
    const bytes = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="student-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
