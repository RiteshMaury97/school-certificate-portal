import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileWarning,
  Inbox,
  UserRound,
} from "lucide-react";

import type { Dispatch, SetStateAction } from "react";

type ReportStatus = "open" | "reviewing" | "resolved" | "rejected";
type ReportsTabProps = {
  reports: Record<string, unknown>[];
  loaded: boolean;
  reportNotes: Record<string, string>;
  setReportNotes: Dispatch<SetStateAction<Record<string, string>>>;
  updateReport: (id: string, status: ReportStatus) => void;
  reportReplies: Record<string, string>;
  setReportReplies: Dispatch<SetStateAction<Record<string, string>>>;
  sendReportReply: (id: string, reply: string) => void;
};

function displayValue(value: unknown, fallback = "—"): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function getStatus(value: unknown): ReportStatus {
  return value === "reviewing" || value === "resolved" || value === "rejected" ? value : "open";
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const styles: Record<ReportStatus, string> = {
    open: "bg-[color-mix(in_srgb,var(--warning)_12%,var(--surface))] text-[var(--warning)]",
    reviewing: "bg-[color-mix(in_srgb,var(--primary)_12%,var(--surface))] text-[var(--primary)]",
    resolved: "bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] text-[var(--success)]",
    rejected: "bg-[color-mix(in_srgb,var(--danger)_10%,var(--surface))] text-[var(--danger)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold capitalize ${styles[status]}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function QueueHeader({ reports }: { reports: Record<string, unknown>[] }) {
  const open = reports.filter((report) => getStatus(report.status) === "open").length;
  const reviewing = reports.filter((report) => getStatus(report.status) === "reviewing").length;
  const resolved = reports.filter((report) => getStatus(report.status) === "resolved").length;
  return (
    <>
      <header className="relative overflow-hidden rounded-2xl bg-[var(--primary)] p-6 text-[var(--on-primary)] shadow-[var(--shadow-card)] sm:p-8">
        <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[32px] border-white/10" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
              Student support
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Report review queue
            </h2>
            <p className="mt-2 text-sm leading-6 opacity-85">
              Review record corrections submitted through the public portal and keep each case
              moving.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold">
            <FileWarning size={17} className="text-[var(--accent)]" aria-hidden="true" />
            {reports.length} {reports.length === 1 ? "report" : "reports"}
          </span>
        </div>
      </header>
      <section aria-label="Report status summary" className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Awaiting review" count={open} icon={AlertCircle} />
        <SummaryCard label="In progress" count={reviewing} icon={Clock3} />
        <SummaryCard label="Resolved" count={resolved} icon={CheckCircle2} />
      </section>
    </>
  );
}

function SummaryCard({
  label,
  count,
  icon: Icon,
}: {
  label: string;
  count: number;
  icon: typeof AlertCircle;
}) {
  return (
    <article className="flex items-center gap-4 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs text-[var(--text-muted)]">{label}</p>
        <p className="mt-0.5 text-xl font-bold tracking-tight">{count}</p>
      </div>
    </article>
  );
}

function StatusActions({
  id,
  status,
  updateReport,
}: {
  id: string;
  status: ReportStatus;
  updateReport: ReportsTabProps["updateReport"];
}) {
  const options: { value: ReportStatus; label: string; icon: typeof ClipboardCheck }[] = [
    { value: "open", label: "Reopen", icon: Inbox },
    { value: "reviewing", label: "Start review", icon: ClipboardCheck },
    { value: "resolved", label: "Resolve", icon: CheckCircle2 },
    { value: "rejected", label: "Reject", icon: AlertCircle },
  ];
  return (
    <div className="flex flex-wrap gap-2" aria-label={`Update status for report ${id}`}>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={status === value}
          onClick={() => {
            updateReport(id, value);
          }}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition ${
            status === value
              ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]"
              : "border-[var(--divider)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--surface-2)]"
          }`}
        >
          <Icon size={14} aria-hidden="true" /> {label}
        </button>
      ))}
    </div>
  );
}

function ReportCard({
  report,
  note,
  setNote,
  updateReport,
  reportReply,
  setReportReply,
  sendReportReply,
}: {
  report: Record<string, unknown>;
  note: string;
  setNote: (id: string, note: string) => void;
  updateReport: ReportsTabProps["updateReport"];
  reportReply: string;
  setReportReply: (value: string) => void;
  sendReportReply: ReportsTabProps["sendReportReply"];
}) {
  const id = displayValue(report.id, "Unknown reference");
  const status = getStatus(report.status);
  const optedInPhone = report.phoneOptIn === true ? report.phoneNumber : null;
  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)] shadow-sm transition hover:shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--divider)] bg-[var(--surface-2)]/55 px-5 py-4 sm:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--text-muted)]">
            Reference number
          </p>
          <h3 className="mt-1 font-mono text-sm font-bold text-[var(--text)]">{id}</h3>
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(250px,.72fr)]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--primary)]">
              <UserRound size={18} aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-[var(--text)]">
                {displayValue(report.name, "Name not provided")}
              </p>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                Academic session · {displayValue(report.session)}
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--divider)] bg-[var(--surface-2)]/45 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Reported issue
            </p>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">
              {displayValue(report.issue, "No details were added.")}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--text-muted)]">
            <p>Submitted {displayValue(report.createdAt, "date unavailable")}</p>
            {typeof optedInPhone === "string" && optedInPhone.length > 0 && (
              <p>Phone follow-up: {optedInPhone}</p>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-[var(--divider)] p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Preferred contact · {displayValue(report.contactMethod, "email")}
            </p>
            <p className="mt-1 break-words text-sm font-medium text-[var(--text)]">
              {displayValue(report.contact, "Not provided")}
            </p>
          </div>
          <label
            htmlFor={`report-note-${id}`}
            className="block text-xs font-semibold text-[var(--text)]"
          >
            Internal handling note
            <textarea
              id={`report-note-${id}`}
              aria-label={`Internal handling note for ${id}`}
              translate="no"
              value={note}
              onChange={(event) => {
                setNote(id, event.target.value);
              }}
              placeholder="Add a note for the staff handling this report"
              rows={3}
              maxLength={2000}
              className="mt-2 min-h-24 w-full resize-y rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-3 text-sm font-normal"
            />
          </label>
          <StatusActions id={id} status={status} updateReport={updateReport} />
          <div className="border-t border-[var(--divider)] pt-3">
            <p
              id={`report-reply-label-${id}`}
              className="text-xs font-semibold text-[var(--text-muted)]"
            >
              Email response to{" "}
              {displayValue(report.email, displayValue(report.contact, "reporter"))}
            </p>
            <textarea
              id={`report-reply-${id}`}
              aria-labelledby={`report-reply-label-${id}`}
              value={reportReply}
              onChange={(event) => {
                setReportReply(event.target.value);
              }}
              rows={3}
              maxLength={3000}
              placeholder="Write a response for the reporter…"
              className="mt-2 min-h-20 w-full resize-y rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-3 text-sm"
            required aria-required="true" />
            <button
              type="button"
              disabled={!reportReply.trim() || (!report.email && report.contactMethod !== "email")}
              onClick={() => {
                sendReportReply(id, reportReply);
              }}
              className="mt-2 min-h-10 rounded-lg bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--on-primary)] disabled:opacity-50"
            >
              Send email response
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyQueue() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--divider)] bg-[var(--surface)] px-5 py-14 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-2)] text-[var(--primary)]">
        <Inbox size={22} aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-semibold text-[var(--text)]">Your queue is clear</h3>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[var(--text-muted)]">
        New wrong-record reports submitted through the public portal will appear here for review.
      </p>
    </div>
  );
}

export default function ReportsTab({
  reports,
  loaded,
  reportNotes,
  setReportNotes,
  updateReport,
  reportReplies,
  setReportReplies,
  sendReportReply,
}: ReportsTabProps) {
  return (
    <div className="space-y-5">
      <QueueHeader reports={reports} />
      <section aria-label="Wrong-record report queue" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[var(--text)]">Incoming reports</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Review confidential student-record details with authorized staff only.
            </p>
          </div>
          <span className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
            {reports.length} total
          </span>
        </div>
        {loaded && reports.length === 0 && <EmptyQueue />}
        {reports.map((report, index) => {
          const id = displayValue(report.id, `report-${String(index)}`);
          return (
            <ReportCard
              key={id}
              report={report}
              note={reportNotes[id] ?? displayValue(report.adminNote, "")}
              setNote={(reportId, value) => {
                setReportNotes((current) => ({ ...current, [reportId]: value }));
              }}
              reportReply={reportReplies[id] ?? ""}
              setReportReply={(value) => {
                setReportReplies((current) => ({ ...current, [id]: value }));
              }}
              sendReportReply={sendReportReply}
              updateReport={updateReport}
            />
          );
        })}
      </section>
    </div>
  );
}
