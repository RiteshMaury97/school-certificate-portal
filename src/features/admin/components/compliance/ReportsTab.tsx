import type { Dispatch, SetStateAction } from "react";

type ReportsTabProps = {
  reports: Record<string, unknown>[];
  reportNotes: Record<string, string>;
  setReportNotes: Dispatch<SetStateAction<Record<string, string>>>;
  updateReport: (id: string, status: "open" | "reviewing" | "resolved" | "rejected") => void;
};

export default function ReportsTab({ reports, reportNotes, setReportNotes, updateReport }: ReportsTabProps) {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
      <h2 className="text-lg font-bold">Wrong-record reports</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Reference IDs submitted by the public portal. Limit access to staff handling student records.
      </p>
      <div className="mt-5 space-y-3">
        {reports.map((r) => (
          <article key={String(r.id)} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b>{String(r.id)}</b>
              <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold">{String(r.status ?? "open")}</span>
            </div>
            <p className="mt-2 text-sm"><b>{String(r.name ?? "")}</b> · {String(r.session ?? "")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text)]">{String(r.issue ?? "")}</p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">Contact: {String(r.contact ?? "")} · Created: {String(r.createdAt ?? "")}</p>
            <textarea
              translate="no"
              value={reportNotes[String(r.id)] ?? String(r.adminNote ?? "")}
              onChange={(e) => { setReportNotes((v) => ({ ...v, [String(r.id)]: e.target.value })); }}
              placeholder="Internal handling note"
              rows={2}
              className="mt-3 w-full rounded border p-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {(["open", "reviewing", "resolved", "rejected"] as const).map((status) => (
                <button key={status} onClick={() => { updateReport(String(r.id), status); }} className="rounded border px-3 py-1.5 text-xs font-semibold capitalize">{status}</button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
