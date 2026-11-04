export type ExportIncident = Record<string, unknown> & { id: string };
export type ExportUpdate = {
  at?: string;
  byUid?: string;
  note?: string;
  statusChange?: string | null;
};

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : formatValue(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function breachCsv(incidents: ExportIncident[], updates: ExportUpdate[] = []): string {
  const rows = [["recordType", "incidentId", "field", "value", "at", "byUid"]];
  for (const incident of incidents) {
    for (const [field, value] of Object.entries(incident)) {
      if (field !== "id") rows.push(["incident", incident.id, field, formatValue(value), "", ""]);
    }
    for (const update of updates) {
      rows.push([
        "update",
        incident.id,
        update.statusChange ? "statusChange" : "note",
        update.note ?? update.statusChange ?? "",
        update.at ?? "",
        update.byUid ?? "",
      ]);
    }
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => formatValue(item)).join("; ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "";
}

export function breachReportLines(
  incident: ExportIncident,
  updates: ExportUpdate[] = [],
): string[] {
  const lines = [`Personal data breach report — ${incident.id}`, ""];
  for (const [field, value] of Object.entries(incident)) {
    if (field === "id") continue;
    lines.push(`${field}: ${formatValue(value) || "Not recorded"}`);
  }
  lines.push("", "Update timeline");
  for (const update of updates) {
    lines.push(
      `${update.at ?? "Time not recorded"} · ${update.byUid ?? "Admin"} · ${update.statusChange ?? "Note"} · ${update.note ?? ""}`,
    );
  }
  return lines;
}
