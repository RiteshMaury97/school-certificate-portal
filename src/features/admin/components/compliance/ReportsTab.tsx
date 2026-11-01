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

const statuses: ReportStatus[] = ["open", "reviewing", "resolved", "rejected"];

function statusStyle(status: string, active: boolean): string {
  if (active) return "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]";
  if (status === "resolved") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "reviewing") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:border-[var(--primary)]";
}

export default function ReportsTab({
  reports,
  loaded,
  reportNotes,
  setReportNotes,
  updateReport,
}: ReportsTabProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <header className="border-b border-[var(--divider)] bg-[var(--surface-2)]/60 px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
              Record integrity
            </p>
            <h2 className="mt-1 text-xl font-bold text-[var(--text)]">Wrong-record reports</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
              Review correction requests, add internal notes, and track each case through
              resolution.
            </p>
          </div>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text)]">
            {reports.length} {reports.length === 1 ? "report" : "reports"}
          </span>
        </div>
      </header>
      <div className="space-y-4 p-4 sm:p-6">
        {loaded && reports.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-12 text-center">
            <span
              className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--surface)] text-lg text-[var(--primary)]"
              aria-hidden="true"
            >
              ✓
            </span>
            <p className="mt-3 font-semibold text-[var(--text)]">All caught up</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Public record correction requests will appear here.
            </p>
          </div>
        )}
        {reports.map((report) => {
          const id = displayValue(report.id);
          const status = displayValue(report.status, "open");
          return (
            <article
              key={id}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--divider)] px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-bold tracking-wide text-[var(--primary)]">
                    {id}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-[var(--text)]">
                    {displayValue(report.name, "Unnamed student")}
                  </h3>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                    Passing session: {displayValue(report.session, "Not provided")}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusStyle(status, false)}`}
                >
                  {status}
                </span>
              </div>
              <div className="space-y-4 p-4 sm:p-5">
                <div className="rounded-lg bg-[var(--surface-2)] p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Issue reported
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-[var(--text)]">
                    {displayValue(report.issue, "No description provided")}
                  </p>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-medium text-[var(--text-muted)]">Phone</dt>
                    <dd className="mt-1 break-words font-medium text-[var(--text)]">
                      {displayValue(report.phoneNumber, "Not provided")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[var(--text-muted)]">Email</dt>
                    <dd className="mt-1 break-words font-medium text-[var(--text)]">
                      {displayValue(report.contactEmail ?? report.contact, "Not provided")}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[var(--text-muted)]">Submitted</dt>
                    <dd className="mt-1 break-words font-medium text-[var(--text)]">
                      {displayValue(report.createdAt, "Time unavailable")}
                    </dd>
                  </div>
                </dl>
                <label className="block text-xs font-bold text-[var(--text-muted)]">
                  Internal case note
                  <textarea
                    translate="no"
                    value={reportNotes[id] ?? displayValue(report.adminNote)}
                    onChange={(event) => {
                      setReportNotes((current) => ({ ...current, [id]: event.target.value }));
                    }}
                    aria-label={`Internal note for report ${id}`}
                    placeholder="Add investigation notes for staff"
                    rows={3}
                    className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm font-normal text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus)]"
                  />
                </label>
              </div>
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--divider)] bg-[var(--surface-2)]/50 px-4 py-3 sm:px-5">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  Update case status
                </span>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((nextStatus) => (
                    <button
                      key={nextStatus}
                      type="button"
                      onClick={() => {
                        updateReport(id, nextStatus);
                      }}
                      aria-pressed={status === nextStatus}
                      className={`min-h-9 rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${statusStyle(nextStatus, status === nextStatus)}`}
                    >
                      {nextStatus}
                    </button>
                  ))}
                </div>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
