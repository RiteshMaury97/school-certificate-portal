import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { db } from "@/server/firebase-admin";
import { apiError, requireRoles } from "@/server/security";
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
type Catalogs = { classes: string[]; sessions: string[] };

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await requireRoles(request, ["uploader", "admin", "superadmin"]);
    const format = request.nextUrl.searchParams.get("format") ?? "csv";
    const catalogs = await loadCatalogs();
    return await buildTemplate(format, catalogs);
  } catch (error) {
    return apiError(error);
  }
}

async function loadCatalogs(): Promise<Catalogs> {
  const [classesResult, sessionsResult] = await Promise.allSettled([
    db.collection("classes").get(),
    db.collection("sessions").get(),
  ]);
  // Template downloads should remain available during a brief catalog read outage. Empty
  // catalogs omit dropdowns; imports still validate values against the live catalogs.
  const classesSnapshot = classesResult.status === "fulfilled" ? classesResult.value : null;
  const sessionsSnapshot = sessionsResult.status === "fulfilled" ? sessionsResult.value : null;
  if (!classesSnapshot || !sessionsSnapshot)
    console.error("[admin/templates] One or more catalog reads failed", {
      classes: classesResult.status,
      sessions: sessionsResult.status,
    });
  const classes = (classesSnapshot?.docs ?? [])
    .filter((doc) => doc.get("isActive") !== false)
    .map((doc) => String(doc.get("label") ?? doc.get("name") ?? doc.id).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const sessions = [
    ...new Set(
      (sessionsSnapshot?.docs ?? [])
        .filter((doc) => doc.get("isActive") !== false)
        .map((doc) =>
          normalizeAcademicSession(String(doc.get("label") ?? doc.get("name") ?? doc.id)),
        )
        .filter((value): value is string => value !== null),
    ),
  ].sort();
  return { classes, sessions };
}

async function buildTemplate(format: string, catalogs: Catalogs): Promise<NextResponse> {
  if (format === "csv") return csvTemplate(catalogs);
  if (format !== "xlsx")
    return NextResponse.json({ error: "Choose csv or xlsx." }, { status: 400 });
  try {
    return await xlsxTemplate(catalogs);
  } catch (error) {
    console.error("[admin/templates] Excel workbook generation failed; returning CSV template", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
    });
    return csvTemplate(catalogs);
  }
}

function csvTemplate({ classes, sessions }: Catalogs): NextResponse {
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
  const content =
    [
      headers.join(","),
      sample.map((value) => `"${value.replace(/"/g, '""')}"`).join(","),
      "# Delete the DEMO row and use one student per row.",
      `# Active class names: ${classes.join("; ") || "none configured"}. Use an exact name.`,
      `# Active sessions: ${sessions.join("; ") || "none configured"}. Use exact YYYY-YY format.`,
      "# Required: studentName, fatherName, motherName, scholarNumber, className and session.",
      "# admissionNumber and dateOfBirth are optional; use them to distinguish duplicate names.",
    ].join("\r\n") + "\r\n";
  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="student-import-template.csv"',
      "Cache-Control": "no-store",
    },
  });
}

async function xlsxTemplate(catalogs: Catalogs): Promise<NextResponse> {
  const workbook = new ExcelJS.Workbook();
  const studentSheet = workbook.addWorksheet("Student Data");
  populateStudentSheet(studentSheet, catalogs);
  populateAllowedSheet(workbook, catalogs);
  // Use the Allowed Values sheet instead of workbook dropdown metadata. The importer
  // validates class and session values on upload, and this keeps xlsx generation portable.
  populateGuideSheet(workbook);
  const output = await workbook.xlsx.writeBuffer();
  return new NextResponse(new Uint8Array(output), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="student-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}

function populateStudentSheet(sheet: ExcelJS.Worksheet, catalogs: Catalogs): void {
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(18, header.length + 8),
  }));
  sheet.autoFilter = { from: "A1", to: "H501" };
  sheet.getColumn("scholarNumber").numFmt = "@";
  sheet.getColumn("admissionNumber").numFmt = "@";
  sheet.addRow([
    "Aarav Sharma",
    "Rohan Sharma",
    "Meera Sharma",
    "DEMO-SCH-001",
    catalogs.classes[0] ?? "",
    catalogs.sessions[0] ?? "",
    "DEMO-ADM-001",
    "2010-04-15",
  ]);
  sheet.getRow(2).font = { color: { argb: "FF64748B" }, italic: true };
}

function populateAllowedSheet(workbook: ExcelJS.Workbook, catalogs: Catalogs): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet("Allowed Values");
  sheet.addRow(["Active class names", "", "Active sessions (YYYY-YY)"]);
  sheet.getRow(1).font = { bold: true };
  for (let row = 0; row < Math.max(catalogs.classes.length, catalogs.sessions.length); row++)
    sheet.addRow([catalogs.classes[row] ?? "", "", catalogs.sessions[row] ?? ""]);
  sheet.getColumn(1).width = 36;
  sheet.getColumn(3).width = 32;
  return sheet;
}

function populateGuideSheet(workbook: ExcelJS.Workbook): void {
  const guide = workbook.addWorksheet("Format Guide");
  guide.addRows([
    ["Student Excel import â€” format guide"],
    ["Delete the DEMO row in Student Data, then add one student per row."],
    ["Use the exact class and session values listed on the Allowed Values sheet."],
    ["Wrong class/session formats are rejected; the preview identifies the Excel row and column."],
    [
      "Only a fully valid preview can be imported. Add certificates afterward from each student row.",
    ],
    [""],
    ["Column", "Required", "Expected format"],
    [
      "studentName",
      "Yes",
      "Student's official name; 2â€“100 letters, spaces, apostrophes, periods or hyphens.",
    ],
    ["fatherName", "Yes", "Father's official name; use the school register spelling."],
    ["motherName", "Yes", "Mother's official name; use the school register spelling."],
    [
      "scholarNumber",
      "Yes",
      "Unique within the selected class and session; letters, numbers, spaces, / or -.",
    ],
    [
      "className",
      "Yes",
      "Choose an exact active value from Allowed Values (for example Class 10 A only if listed).",
    ],
    ["session", "Yes", "Choose an active YYYY-YY value, e.g. 2025-26."],
    [
      "admissionNumber",
      "No",
      "Admission number; used to distinguish students with the same names.",
    ],
    [
      "dateOfBirth",
      "No",
      "Valid date formatted as YYYY-MM-DD; also used to distinguish matching names.",
    ],
    [
      "Certificates",
      "No",
      "Do not add certificate files to this workbook. Upload them from the student's table row.",
    ],
  ]);
  guide.getColumn(1).width = 30;
  guide.getColumn(2).width = 20;
  guide.getColumn(3).width = 100;
  guide.mergeCells("A1:C1");
  guide.getRow(1).font = { bold: true, size: 14 };
  guide.getRow(1).height = 24;
  guide.views = [{ state: "frozen", ySplit: 1 }];
}
