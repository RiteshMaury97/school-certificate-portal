import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { requireRoles, apiError } from "@/server/security";
import { normalizeAcademicSession } from "@/shared/academic-session";

import type { NextRequest } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = [
  "studentName",
  "fatherName",
  "motherName",
  "scholarNumber",
  "className",
  "session",
  "admissionNumber",
  "dateOfBirth",
];
export async function GET(request: NextRequest) {
  try {
    await requireRoles(request, ["uploader", "admin"]);
    const format = request.nextUrl.searchParams.get("format") ?? "csv";
    const [classesSnapshot, sessionsSnapshot] = await Promise.all([
      db.collection("classes").get(),
      db.collection("sessions").get(),
    ]);
    const classes = classesSnapshot.docs
      .filter((document) => document.get("isActive") !== false)
      .map((document) =>
        String(document.get("label") ?? document.get("name") ?? document.id).trim(),
      )
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right));
    const sessions = [
      ...new Set(
        sessionsSnapshot.docs
          .filter((document) => document.get("isActive") !== false)
          .map((document) =>
            normalizeAcademicSession(
              String(
                document.get("label") ?? document.get("name") ?? document.id,
              ),
            ),
          )
          .filter((value): value is string => value !== null),
      ),
    ].sort();
    if (format === "csv") {
      const sample = [
        "Aarav Sharma",
        "Rohan Sharma",
        "Meera Sharma",
        "DEMO-SCH-001",
        classes[0] ?? "",
        sessions[0] ?? "",
        "DEMO-ADM-001",
        "2010-04-15",
      ];
      const csv =
        [
          headers.join(","),
          sample.map((v) => `"${v.replace(/"/g, '""')}"`).join(","),
          "# Delete the DEMO row and use one student per row.",
          `# Active class names: ${classes.join("; ") || "none configured"}. Use an exact name.`,
          `# Active sessions: ${sessions.join("; ") || "none configured"}. Use exact YYYY-YY format.`,
          "# Required: studentName, fatherName, motherName, scholarNumber, className and session.",
          "# admissionNumber and dateOfBirth are optional; use them to distinguish duplicate names.",
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
    const sheet = workbook.addWorksheet("Student Data");
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    sheet.columns = headers.map((h) => ({
      header: h,
      key: h,
      width: Math.max(18, h.length + 8),
    }));
    sheet.autoFilter = { from: "A1", to: "H501" };
    sheet.getColumn("scholarNumber").numFmt = "@";
    sheet.getColumn("admissionNumber").numFmt = "@";
    sheet.addRow([
      "Aarav Sharma",
      "Rohan Sharma",
      "Meera Sharma",
      "DEMO-SCH-001",
      classes[0] ?? "",
      sessions[0] ?? "",
      "DEMO-ADM-001",
      "2010-04-15",
    ]);
    sheet.getRow(2).font = { color: { argb: "FF64748B" }, italic: true };

    const allowed = workbook.addWorksheet("Allowed Values");
    allowed.addRow(["Active class names", "", "Active sessions (YYYY-YY)"]);
    allowed.getRow(1).font = { bold: true };
    for (let index = 0; index < Math.max(classes.length, sessions.length); index++)
      allowed.addRow([classes[index] ?? "", "", sessions[index] ?? ""]);
    allowed.getColumn(1).width = 36;
    allowed.getColumn(3).width = 32;
    if (classes.length) {
      workbook.definedNames.add(
        `'Allowed Values'!$A$2:$A$${classes.length + 1}`,
        "ClassNames",
      );
      sheet.dataValidations.add("E2:E501", {
        type: "list",
        allowBlank: false,
        formulae: ["ClassNames"],
        showErrorMessage: true,
        errorTitle: "Invalid class name",
        error: "Select an exact value from the Allowed Values sheet.",
      });
    }
    if (sessions.length) {
      workbook.definedNames.add(
        `'Allowed Values'!$C$2:$C$${sessions.length + 1}`,
        "AcademicSessions",
      );
      sheet.dataValidations.add("F2:F501", {
        type: "list",
        allowBlank: false,
        formulae: ["AcademicSessions"],
        showErrorMessage: true,
        errorTitle: "Invalid academic session",
        error: "Select an active session in YYYY-YY format.",
      });
    }

    const guide = workbook.addWorksheet("Format Guide");
    guide.addRows([
      ["Student Excel import — format guide"],
      ["Delete the DEMO row in Student Data, then add one student per row."],
      ["Use the exact class and session values from the dropdowns / Allowed Values sheet."],
      ["Wrong class/session formats are rejected; the preview identifies the Excel row and column."],
      ["Only a fully valid preview can be imported. Add certificates afterward from each student row."],
      [""],
      ["Column", "Required", "Expected format"],
      ["studentName", "Yes", "Student's official name; 2–100 letters, spaces, apostrophes, periods or hyphens."],
      ["fatherName", "Yes", "Father's official name; use the school register spelling."],
      ["motherName", "Yes", "Mother's official name; use the school register spelling."],
      ["scholarNumber", "Yes", "Unique within the selected class and session; letters, numbers, spaces, / or -."],
      ["className", "Yes", "Choose an exact active value from Allowed Values (for example Class 10 A only if listed)."],
      ["session", "Yes", "Choose an active YYYY-YY value, e.g. 2025-26."],
      ["admissionNumber", "No", "Admission number; used to distinguish students with the same names."],
      ["dateOfBirth", "No", "Valid date formatted as YYYY-MM-DD; also used to distinguish matching names."],
      ["Certificates", "No", "Do not add certificate files to this workbook. Upload them from the student's table row."],
    ]);
    guide.getColumn(1).width = 30;
    guide.getColumn(2).width = 20;
    guide.getColumn(3).width = 100;
    guide.mergeCells("A1:C1");
    guide.getRow(1).font = { bold: true, size: 14 };
    guide.getRow(1).height = 24;
    guide.views = [{ state: "frozen", ySplit: 1 }];

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
