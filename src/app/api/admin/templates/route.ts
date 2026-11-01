import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { requireRoles, apiError } from "@/server/security";

import type { NextRequest} from "next/server";
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
  "Class 10",
  "ADM-2023-001",
  "2010-04-15",
  "Rahul Kumar",
  "Amit Kumar",
  "Sunita Kumar",
  "2023-24",
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
          "Content-Disposition":
            'attachment; filename="student-import-template.csv"',
          "Cache-Control": "no-store",
        },
      });
    }
    if (format !== "xlsx")
      return NextResponse.json(
        { error: "Choose csv or xlsx." },
        { status: 400 },
      );
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Import Template");
    sheet.addRow(headers);
    sheet.addRow(sample);
    sheet.getRow(1).font = { bold: true };
    sheet.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: Math.max(18, h.length + 4),
    }));
    const notes = workbook.addWorksheet("Validation Notes");
    notes.addRows([
      ["Column", "Required", "Validation"],
      ["scholarNumber", "Required", "Unique within class and session."],
      ["className", "Required", "Class and optional section, e.g. Class 10 A."],
      ["admissionNumber", "Optional", "Stored encrypted; used to distinguish duplicate names."],
      ["dateOfBirth", "Optional", "YYYY-MM-DD; stored encrypted and used to distinguish duplicate names."],
      [
        "studentName/fatherName/motherName",
        "Required for student matching",
        "Use the exact spelling in school records.",
      ],
      ["session", "Required", "YYYY-YY, e.g. 2023-24."],
    ]);
    notes.columns = [{ width: 28 }, { width: 24 }, { width: 90 }];
    const bytes = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="student-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
