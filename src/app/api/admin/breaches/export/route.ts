import { Timestamp } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { listBreaches } from "@/server/breaches";
import { db } from "@/server/firebase-admin";
import { apiError, requireRoles, writeAuditLog } from "@/server/security";
import {
  breachCsv,
  breachReportLines,
  type ExportIncident,
  type ExportUpdate,
} from "@/shared/breach-export";

import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function asIncident(value: Record<string, unknown>): ExportIncident | null {
  return typeof value.id === "string" ? { ...value, id: value.id } : null;
}

async function allIncidents(start: string | null, end: string | null): Promise<ExportIncident[]> {
  const values: ExportIncident[] = [];
  let page = 1;
  let total = Number.MAX_SAFE_INTEGER;
  while (values.length < total) {
    const result = await listBreaches({
      status: null,
      severity: null,
      start,
      end,
      search: "",
      page,
      pageSize: 100,
    });
    values.push(
      ...result.breaches.map(asIncident).filter((item): item is ExportIncident => item !== null),
    );
    total = result.total;
    if (result.breaches.length === 0) return values;
    page += 1;
  }
  return values;
}

function dateValue(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : "";
}

async function loadSingleIncident(
  id: string,
): Promise<{ incident: ExportIncident; updates: ExportUpdate[] } | null> {
  const reference = db.collection("breaches").doc(id);
  const snapshot = await reference.get();
  if (!snapshot.exists) return null;
  const incident: ExportIncident = { ...(snapshot.data() ?? {}), id };
  const updateSnapshot = await reference.collection("updates").orderBy("at", "asc").get();
  const updates: ExportUpdate[] = updateSnapshot.docs.map((item) => ({
    ...item.data(),
    at: dateValue(item.get("at")),
  }));
  return { incident, updates };
}

function validateDateRange(start: string | null, end: string | null): string | null {
  if ((start && !Number.isFinite(Date.parse(start))) || (end && !Number.isFinite(Date.parse(end))))
    return "Invalid date range.";
  return null;
}

async function createExport(request: NextRequest, adminUid: string): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const format = params.get("format");
  const id = params.get("id");
  const start = params.get("start");
  const end = params.get("end");
  if (format !== "csv" && format !== "pdf")
    return NextResponse.json({ error: "Choose PDF or CSV." }, { status: 400 });
  const dateError = validateDateRange(start, end);
  if (dateError) return NextResponse.json({ error: dateError }, { status: 400 });
  let incidents: ExportIncident[];
  let updates: ExportUpdate[] = [];
  if (id) {
    const single = await loadSingleIncident(id);
    if (!single) return NextResponse.json({ error: "Incident not found." }, { status: 404 });
    incidents = [single.incident];
    updates = single.updates;
  } else {
    incidents = await allIncidents(start, end);
    if (!incidents.length)
      return NextResponse.json(
        { error: "No incidents found for this date range." },
        { status: 404 },
      );
  }
  await writeAuditLog(request, adminUid, "breach.exported", id ?? "register", undefined, {
    changedFields: [format, ...(start ? ["start"] : []), ...(end ? ["end"] : [])],
  });
  if (format === "csv")
    return csvResponse(
      breachCsv(incidents, updates),
      id ? `incident-${id}.csv` : "breach-register.csv",
    );
  const lines = incidents.flatMap((incident) => [
    ...breachReportLines(incident, updates),
    "",
    "---",
    "",
  ]);
  return pdfResponse(lines, id ? `incident-${id}.pdf` : "breach-register.pdf");
}

async function pdfResponse(lines: string[], filename: string): Promise<NextResponse> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  let page = document.addPage([595, 842]);
  let y = 800;
  for (const line of lines) {
    const wrapped = line.match(/.{1,92}(?:\s|$)|\S+/g) ?? [""];
    for (const row of wrapped) {
      if (y < 45) {
        page = document.addPage([595, 842]);
        y = 800;
      }
      page.drawText(row, { x: 40, y, size: 9, font, color: rgb(0.08, 0.12, 0.1), maxWidth: 515 });
      y -= 15;
    }
  }
  const saved = await document.save();
  const body = new ArrayBuffer(saved.byteLength);
  new Uint8Array(body).set(saved);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireRoles(request, ["superadmin"]);
    return await createExport(request, admin.uid);
  } catch (error) {
    return apiError(error);
  }
}
