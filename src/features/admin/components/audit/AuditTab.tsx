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
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Audit logs</h2>
        <div className="flex gap-2">
          <input translate="no" placeholder="Filter action" value={auditAction} onChange={(e) => { setAuditAction(e.target.value); }} className="rounded border px-3 py-2" />
          <input translate="no" type="date" value={auditStart} onChange={(e) => { setAuditStart(e.target.value); }} className="rounded border px-2 py-2" />
          <input translate="no" type="date" value={auditEnd} onChange={(e) => { setAuditEnd(e.target.value); }} className="rounded border px-2 py-2" />
          <button onClick={() => load()} className="rounded border px-3">Filter</button>
          <a
            href={`/api/admin/audit?format=csv${auditAction ? `&action=${encodeURIComponent(auditAction)}` : ""}${auditStart ? `&start=${encodeURIComponent(new Date(auditStart).toISOString())}` : ""}${auditEnd ? `&end=${encodeURIComponent(new Date(auditEnd + "T23:59:59").toISOString())}` : ""}`}
            className="rounded bg-[var(--primary)] px-3 py-2 text-[var(--on-primary)]"
          >
            Export CSV
          </a>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {logs.map((l, i) => (
          <article key={String(l.id ?? i)} className="rounded border p-3 text-sm">
            <b>{String(l.action ?? "")}</b> · {String(l.timestamp ?? "")}
            <p className="text-xs text-[var(--text-muted)]">
              Actor: {String(l.actorUid ?? "")} · IP hash: {String(l.ipHash ?? "")}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
