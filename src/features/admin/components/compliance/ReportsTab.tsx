import type { Dispatch, SetStateAction } from "react";

type ReportStatus = "open" | "reviewing" | "resolved" | "rejected";
type ReportsTabProps = {
  reports: Record<string, unknown>[];
  loaded: boolean;
  reportNotes: Record<string, string>;
  setReportNotes: Dispatch<SetStateAction<Record<string, string>>>;
  updateReport: (id: string, status: ReportStatus) => void;
};

function displayValue(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

export default function ReportsTab({ reports, loaded, reportNotes, setReportNotes, updateReport }: ReportsTabProps) {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
      <h2 className="text-lg font-bold">Wrong-record reports</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Reference IDs submitted by the public portal. Limit access to staff handling student records.
      </p>
      <div className="mt-5 space-y-3">
        {loaded && reports.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-10 text-center">
            <p className="font-semibold text-[var(--text)]">No reports in the database</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Wrong-record reports submitted through the public portal will appear here.
            </p>
          </div>
        )}
        {reports.map((report) => {
          const id = displayValue(report.id);
          return (
            <article key={id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b>{id}</b>
                <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold">{displayValue(report.status, "open")}</span>
              </div>
              <p className="mt-2 text-sm"><b>{displayValue(report.name)}</b> · {displayValue(report.session)}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text)]">{displayValue(report.issue)}</p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">Contact: {displayValue(report.contact)} · Created: {displayValue(report.createdAt)}</p>
              <textarea
                translate="no"
                value={reportNotes[id] ?? displayValue(report.adminNote)}
                onChange={(event) => { setReportNotes((current) => ({ ...current, [id]: event.target.value })); }}
                aria-label={`Internal note for report ${id}`}
                placeholder="Internal handling note"
                rows={2}
                className="mt-3 w-full rounded border p-2 text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {(["open", "reviewing", "resolved", "rejected"] as const).map((status) => (
                  <button key={status} onClick={() => { updateReport(id, status); }} className="rounded border px-3 py-1.5 text-xs font-semibold capitalize">{status}</button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
