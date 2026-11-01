"use client";

import { Activity, CalendarDays, Download, Filter, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";

import PaginationControls from "../shared/PaginationControls";

import type { Dispatch, SetStateAction } from "react";

type AuditTabProps = {
  auditAction: string;
  setAuditAction: Dispatch<SetStateAction<string>>;
  auditStart: string;
  setAuditStart: Dispatch<SetStateAction<string>>;
  auditEnd: string;
  setAuditEnd: Dispatch<SetStateAction<string>>;
  logs: Record<string, unknown>[];
  load: () => Promise<void>;
};

const PAGE_SIZE = 20;

function display(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function formatTimestamp(value: unknown) {
  if (typeof value !== "string" || !value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

type FilterProps = Pick<
  AuditTabProps,
  "auditAction" | "setAuditAction" | "auditStart" | "setAuditStart" | "auditEnd" | "setAuditEnd"
> & { exportUrl: string; onApply: () => void };

function AuditFilters({
  auditAction,
  setAuditAction,
  auditStart,
  setAuditStart,
  auditEnd,
  setAuditEnd,
  exportUrl,
  onApply,
}: FilterProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--primary)]">
          <Filter size={17} aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-semibold text-[var(--text)]">Filter records</h3>
          <p className="text-xs text-[var(--text-muted)]">Narrow results by action and date range</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.2fr)_minmax(150px,1fr)_minmax(150px,1fr)_auto_auto]">
        <label htmlFor="audit-action-filter" className="relative block">
          <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <span className="sr-only">Filter by action</span>
          <input id="audit-action-filter" aria-label="Filter by action" value={auditAction} onChange={(event) => { setAuditAction(event.target.value); }} placeholder="Filter by action" className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]" />
        </label>
        <label htmlFor="audit-start-date" className="relative block">
          <CalendarDays size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <span className="sr-only">Start date</span>
          <input id="audit-start-date" aria-label="Start date" type="date" value={auditStart} onChange={(event) => { setAuditStart(event.target.value); }} className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm text-[var(--text)]" />
        </label>
        <label htmlFor="audit-end-date" className="relative block">
          <CalendarDays size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <span className="sr-only">End date</span>
          <input id="audit-end-date" aria-label="End date" type="date" value={auditEnd} onChange={(event) => { setAuditEnd(event.target.value); }} className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm text-[var(--text)]" />
        </label>
        <button type="button" onClick={onApply} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90">
          <Filter size={15} aria-hidden="true" /> Apply filters
        </button>
        <a href={exportUrl} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]">
          <Download size={15} aria-hidden="true" /> Export CSV
        </a>
      </div>
    </section>
  );
}

function AuditRow({ log, index }: { log: Record<string, unknown>; index: number }) {
  const action = display(log.action, "Admin activity");
  const actor = display(log.actorUid, "System");
  const ipHash = display(log.ipHash, "Not recorded");
  const targetId = display(log.targetId, "");
  return (
    <li className="px-4 py-2.5 sm:px-5">
      <article className="rounded-xl border border-[var(--divider)] bg-[var(--bg)] px-4 py-3 transition-colors hover:bg-[var(--surface-2)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-1 font-mono text-xs font-bold text-[var(--text)]">{action}</span>
            <time dateTime={typeof log.timestamp === "string" ? log.timestamp : undefined} className="text-xs text-[var(--text-muted)]">{formatTimestamp(log.timestamp)}</time>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Audit event</span>
        </div>
        <p className="mt-2 truncate font-mono text-[11px] text-[var(--text-muted)]" title={`Actor: ${actor} · IP hash: ${ipHash}`}>
          <span className="font-sans font-medium">Actor:</span> {actor}
          <span className="mx-2 text-[var(--divider)]">·</span>
          <span className="font-sans font-medium">IP hash:</span> {ipHash}
        </p>
        {action === "certificate.search" && targetId && <p className="mt-1 text-xs text-[var(--text-muted)]">Search outcome: <span className="font-mono">{targetId}</span></p>}
      </article>
      <span className="sr-only">Record {index + 1}</span>
    </li>
  );
}

export default function AuditTab({
  auditAction,
  setAuditAction,
  auditStart,
  setAuditStart,
  auditEnd,
  setAuditEnd,
  logs,
  load,
}: AuditTabProps) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageLogs = logs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const exportUrl = `/api/admin/audit?format=csv${auditAction ? `&action=${encodeURIComponent(auditAction)}` : ""}${auditStart ? `&start=${encodeURIComponent(new Date(auditStart).toISOString())}` : ""}${auditEnd ? `&end=${encodeURIComponent(new Date(auditEnd + "T23:59:59").toISOString())}` : ""}`;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">Admin / Audit logs</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">Audit logs</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">Review security sensitive actions and trace changes across your school workspace.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--success)_12%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--success)]">
            <ShieldCheck size={15} aria-hidden="true" /> Audit trail active
          </div>
        </div>
      </section>

      <AuditFilters
        auditAction={auditAction}
        setAuditAction={setAuditAction}
        auditStart={auditStart}
        setAuditStart={setAuditStart}
        auditEnd={auditEnd}
        setAuditEnd={setAuditEnd}
        exportUrl={exportUrl}
        onApply={() => {
          setPage(1);
          void load();
        }}
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--divider)] px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-[var(--text)]">Latest events</h3>
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">{logs.length.toLocaleString()} records · newest first</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--success)_12%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--success)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" /> Recent activity
          </span>
        </div>
        {logs.length === 0 ? (
          <div className="grid min-h-56 place-items-center px-5 py-12 text-center">
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]"><Activity size={20} /></div>
              <h4 className="mt-3 font-semibold text-[var(--text)]">No audit records found</h4>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Try a different action or date range.</p>
            </div>
          </div>
        ) : (
          <ol className="divide-y divide-[var(--divider)]">
            {pageLogs.map((log, index) => <AuditRow key={display(log.id, String(index))} log={log} index={index} />)}
          </ol>
        )}
        <PaginationControls label="Audit logs" page={currentPage} pageCount={pageCount} pageSize={PAGE_SIZE} total={logs.length} onPageChange={setPage} />
        <p className="border-t border-[var(--divider)] px-5 py-2 text-[11px] text-[var(--text-muted)]">
          Audit records are retained for security and accountability.
        </p>
      </section>
    </div>
  );
}
