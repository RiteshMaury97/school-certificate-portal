import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock3,
  Download,
  Printer,
  Search,
  ShieldAlert,
} from "lucide-react";

import { DatePicker } from "@/components/ui/DatePicker";
import { formatIst, statusOptions, type Filters, type Incident } from "./breach-types";
import { inputClass, warning } from "./BreachFields";

type Props = {
  items: Incident[];
  total: number;
  loaded: boolean;
  isSuperadmin: boolean;
  page: number;
  pageSize: number;
  filters: Filters;
  selectedId: string;
  setPage: (page: number) => void;
  setFilters: (filters: Filters) => void;
  select: (id: string) => void;
};
function since(value: string | null): string {
  if (!value) return "Discovery time unknown";
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  if (!Number.isFinite(elapsed)) return "Discovery time unknown";
  const hours = Math.floor(elapsed / 3_600_000);
  return hours < 24
    ? `${hours.toString()}h since discovery`
    : `${Math.floor(hours / 24).toString()}d since discovery`;
}
function statusIcon(status: string) {
  if (status === "closed") return <CheckCircle2 size={14} aria-hidden="true" />;
  if (status === "reported") return <AlertTriangle size={14} aria-hidden="true" />;
  return <CircleDot size={14} aria-hidden="true" />;
}
function FilterBar({ props }: { props: Props }) {
  function change(key: keyof Filters, value: string) {
    props.setPage(1);
    props.setFilters({ ...props.filters, [key]: value });
  }
  return (
    <div className="space-y-4 border-b border-[var(--border)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Incident register</h3>
          <p className={warning}>{props.total} records · newest discovery first</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              window.print();
            }}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm"
          >
            <Printer size={15} />
            Print
          </button>
          <button
            type="button"
            onClick={() => void exportRegister(props.filters, "csv")}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm"
          >
            <Download size={15} />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void exportRegister(props.filters, "pdf")}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm"
          >
            <Download size={15} />
            Export PDF
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <label htmlFor="incident-search" className="relative sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search incidents</span>
          <Search className="absolute left-3 top-3 text-[var(--text-muted)]" size={15} />
          <input
            id="incident-search"
            aria-label="Search incidents"
            className={`${inputClass} pl-9`}
            value={props.filters.search}
            onChange={(e) => {
              change("search", e.target.value);
            }}
            placeholder="Search incidents"
          />
        </label>
        <select
          aria-label="Filter by status"
          className={inputClass}
          value={props.filters.status}
          onChange={(e) => {
            change("status", e.target.value);
          }}
        >
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filter by severity"
          className={inputClass}
          value={props.filters.severity}
          onChange={(e) => {
            change("severity", e.target.value);
          }}
        >
          <option value="">All severities</option>
          {["low", "medium", "high", "critical"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label className="text-xs text-[var(--text-muted)]">From<DatePicker id="incident-from" label="From date" value={props.filters.start} onChange={(value) => change("start", value)} className="mt-1.5" /></label>
        <label className="text-xs text-[var(--text-muted)]">To<DatePicker id="incident-to" label="To date" value={props.filters.end} onChange={(value) => change("end", value)} className="mt-1.5" /></label>
      </div>
    </div>
  );
}
async function exportRegister(filters: Filters, format: "csv" | "pdf") {
  const query = new URLSearchParams({ format });
  if (filters.start) query.set("start", new Date(`${filters.start}T00:00:00.000Z`).toISOString());
  if (filters.end) query.set("end", new Date(`${filters.end}T23:59:59.999Z`).toISOString());
  const response = await fetch(`/api/admin/breaches/export?${query.toString()}`);
  if (!response.ok) throw new Error("Unable to export the breach register.");
  const extension = format;
  const link = document.createElement("a");
  const url = URL.createObjectURL(await response.blob());
  link.href = url;
  link.download = `breach-register.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
}
function IncidentCard({
  incident,
  selected,
  select,
}: {
  incident: Incident;
  selected: boolean;
  select: (id: string) => void;
}) {
  return (
    <article
      className={`rounded-xl border p-4 sm:p-5 ${selected ? "border-[var(--primary)]" : "border-[var(--border)]"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">{incident.title || "Legacy breach record"}</h4>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">
            {incident.summary || "No summary recorded."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs capitalize">
            <ShieldAlert size={14} />
            {incident.severity || "unknown severity"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs capitalize">
            {statusIcon(incident.status)}
            {incident.status || "reported"}
          </span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1">
          <Clock3 size={13} />
          <time dateTime={incident.discoveredAt ?? undefined}>
            {formatIst(incident.discoveredAt)}
          </time>{" "}
          IST
        </span>
        <span>{since(incident.discoveredAt)}</span>
        <span>
          Estimated affected:{" "}
          {typeof incident.affectedPrincipalsEstimate === "number"
            ? incident.affectedPrincipalsEstimate
            : 0}
        </span>
      </div>
      <button
        type="button"
        aria-expanded={selected}
        onClick={() => {
          select(incident.id);
        }}
        className="mt-4 min-h-10 rounded-lg border border-[var(--border)] px-4 text-sm font-medium"
      >
        {selected ? "Close details" : "Open incident details"}
      </button>
    </article>
  );
}
export default function BreachRegisterList(props: Props) {
  const totalPages = Math.max(1, Math.ceil(props.total / props.pageSize));
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <FilterBar props={props} />
      {props.loaded && !props.items.length ? (
        <div className="p-10 text-center">
          <h3 className="font-semibold">No data found.</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">No incidents have been recorded.</p>
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:p-5">
          {props.items.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              selected={incident.id === props.selectedId}
              select={props.select}
            />
          ))}
        </div>
      )}
      <footer className="flex items-center justify-between border-t border-[var(--border)] p-4 text-sm">
        <span className="text-[var(--text-muted)]">
          Page {props.page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={props.page <= 1}
            onClick={() => {
              props.setPage(Math.max(1, props.page - 1));
            }}
            className="min-h-10 rounded-lg border border-[var(--border)] px-3 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={props.page >= totalPages}
            onClick={() => {
              props.setPage(Math.min(totalPages, props.page + 1));
            }}
            className="min-h-10 rounded-lg border border-[var(--border)] px-3 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </footer>
    </section>
  );
}
