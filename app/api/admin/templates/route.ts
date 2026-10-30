import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireRoles, apiError } from "@/src/lib/security";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = [
  "admissionNumber",
  "dateOfBirth",
  "studentName",
  "fatherName",
  "motherName",
  "session",
  "certificateType",
  "certificateNumber",
  "issueDate",
  "fileName",
];
const sample = [
  "ADM-2023-001",
  "2010-04-15",
  "Rahul Kumar",
  "Amit Kumar",
  "Sunita Kumar",
  "2023-24",
  "Transfer Certificate",
  "TC-2024-001",
  "2024-03-31",
  "ADM-2023-001_transfer-certificate.pdf",
];
export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["uploader"]);
    const format = request.nextUrl.searchParams.get("format") ?? "csv";
    if (format === "csv") {
      const csv =
        [
          headers.join(","),
          sample.map((v) => `"${v.replace(/"/g, '""')}"`).join(","),
          "# Validation notes: studentName, fatherName, motherName and session are required.",
          "# Use the exact spelling in school records; session format is YYYY-YY, e.g. 2023-24.",
          "# certificateType must match a configured type; certificateNumber must be unique.",
          "# issueDate must be YYYY-MM-DD. fileName must match the uploaded file name exactly.",
        ].join("\r\n") + "\r\n";
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="certificate-import-template.csv"',
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
      [
        "admissionNumber",
        "Recommended / required for duplicate names",
        "Stored encrypted; used only to distinguish identical name combinations.",
      ],
      [
        "dateOfBirth",
        "Recommended / required for duplicate names",
        "YYYY-MM-DD; stored encrypted and used only to distinguish identical name combinations.",
      ],
      [
        "studentName/fatherName/motherName",
        "Required for student matching",
        "Use the exact spelling in school records.",
      ],
      ["session", "Required", "YYYY-YY, e.g. 2023-24."],
      [
        "certificateType",
        "Required",
        "Must match a configured certificate type.",
      ],
      ["certificateNumber", "Required", "Unique certificate number."],
      ["issueDate", "Required", "YYYY-MM-DD."],
      [
        "fileName",
        "Required for file matching",
        "Filename can follow admissionNumber_type.pdf.",
      ],
    ]);
    notes.columns = [{ width: 28 }, { width: 24 }, { width: 90 }];
    const bytes = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="certificate-import-template.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
