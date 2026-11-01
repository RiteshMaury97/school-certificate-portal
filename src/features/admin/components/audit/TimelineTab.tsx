"use client";

import { Activity, AlertTriangle, ArrowDownToLine, CheckCircle2, KeyRound, Search } from "lucide-react";
import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import PaginationControls from "../shared/PaginationControls";

type TimelineEvent = Record<string, unknown>;
type Filter = "all" | "uploads" | "approvals" | "otp" | "admin";
const PAGE_SIZE = 20;

type TimelineTabProps = {
  timelineStudentId: string;
  setTimelineStudentId: Dispatch<SetStateAction<string>>;
  timeline: TimelineEvent[];
};

function valueOf(event: TimelineEvent, key: string, fallback = "—") {
  const value = event[key];
  return typeof value === "string" && value ? value : fallback;
}

function categoryOf(action: string): Exclude<Filter, "all"> | "other" {
  const value = action.toLowerCase();
  if (value.includes("upload") || value.includes("import") || value.includes("student.create")) return "uploads";
  if (value.includes("approv") || value.includes("reject") || value.includes("decision")) return "approvals";
  if (value.startsWith("otp.")) return "otp";
  if (value.startsWith("admin.") || value.startsWith("site_") || value.startsWith("site.")) return "admin";
  return "other";
}

function statusLabel(action: string) {
  const lower = action.toLowerCase();
  if (/fail|reject|lock|revoke/.test(lower)) return "Attention";
  if (lower.includes("approv")) return "Approved";
  if (lower.includes("otp.verified")) return "Verified";
  if (lower.includes("otp.sent")) return "Sent";
  if (lower.includes("login")) return "Sign in";
  if (lower.includes("logout")) return "Sign out";
  if (/update|edit|upsert/.test(lower)) return "Updated";
  return "Recorded";
}

function formatTimestamp(value: unknown) {
  if (typeof value !== "string" || !value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All events" },
  { id: "uploads", label: "Uploads" },
  { id: "approvals", label: "Approvals" },
  { id: "otp", label: "OTP activity" },
  { id: "admin", label: "Admin actions" },
];

function TimelineHeader({
  timelineStudentId,
  setTimelineStudentId,
}: Pick<TimelineTabProps, "timelineStudentId" | "setTimelineStudentId">) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">Audit / Activity</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--text)] sm:text-3xl">
            {timelineStudentId ? "Student activity timeline" : "Global activity timeline"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
            Review recent uploads, approvals, account activity, and changes across your school workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {timelineStudentId && (
            <button type="button" onClick={() => { setTimelineStudentId(""); }} className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface-2)]">
              Show global activity
            </button>
          )}
          <a href="/api/admin/audit?format=csv" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90">
            <ArrowDownToLine size={16} aria-hidden="true" /> Export CSV
          </a>
        </div>
      </div>
    </section>
  );
}

function ActivityEventTable({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead className="bg-[var(--surface-2)] text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <tr>
            <th scope="col" className="px-5 py-3">Event</th>
            <th scope="col" className="px-4 py-3">Actor</th>
            <th scope="col" className="px-4 py-3">Date &amp; time</th>
            <th scope="col" className="px-4 py-3">Source / target</th>
            <th scope="col" className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--divider)]">
          {events.map((event, index) => {
            const action = valueOf(event, "action", "Activity");
            const status = statusLabel(action);
            const actor = valueOf(event, "actor", "System");
            const flagged = status === "Attention";
            return (
              <tr key={valueOf(event, "id", String(index))} className="text-sm hover:bg-[var(--surface-2)]/60">
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-[var(--text)]">{action}</p>
                  <p className="mt-0.5 text-xs capitalize text-[var(--text-muted)]">{categoryOf(action)}</p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="font-medium text-[var(--text)]">{actor}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{actor === "Public user" ? "Public visitor" : actor === "System" ? "System" : "Administrator"}</p>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-[var(--text)]">{formatTimestamp(event.timestamp)}</td>
                <td className="max-w-40 truncate px-4 py-3.5 font-mono text-xs text-[var(--text-muted)]" title={valueOf(event, "targetId")}>{valueOf(event, "targetId", "Workspace")}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex min-w-20 justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${flagged ? "bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-[var(--danger)]" : "bg-[var(--surface-2)] text-[var(--text)]"}`}>
                    {status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function TimelineTab({
  timelineStudentId,
  setTimelineStudentId,
  timeline,
}: TimelineTabProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const counts = useMemo(() => {
    const categories = timeline.map((event) => categoryOf(valueOf(event, "action", "Activity")));
    return {
      approvals: categories.filter((category) => category === "approvals").length,
      otp: categories.filter((category) => category === "otp").length,
      flagged: timeline.filter((event) => /fail|reject|lock|revoke|breach/i.test(valueOf(event, "action", ""))).length,
    };
  }, [timeline]);
  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return timeline.filter((event) => {
      const action = valueOf(event, "action", "Activity");
      const category = categoryOf(action);
      const matchesFilter = filter === "all" || category === filter;
      const matchesSearch = !query || [action, valueOf(event, "actor", "System"), valueOf(event, "targetId", "")]
        .join(" ")
        .toLowerCase()
        .includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, search, timeline]);
  const pageCount = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageEvents = filteredEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <TimelineHeader timelineStudentId={timelineStudentId} setTimelineStudentId={setTimelineStudentId} />

      <section aria-label="Activity summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Recent events" value={timeline.length} detail="Latest records loaded" icon={<Activity size={17} />} tone="green" />
        <SummaryCard label="Approvals" value={counts.approvals} detail="In the current activity set" icon={<CheckCircle2 size={17} />} tone="blue" />
        <SummaryCard label="OTP activity" value={counts.otp} detail="Sent and verified codes" icon={<KeyRound size={17} />} tone="violet" />
        <SummaryCard label="Flagged events" value={counts.flagged} detail="Failures, rejects, locks or revocations" icon={<AlertTriangle size={17} />} tone="amber" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--divider)] p-5">
          <div>
            <h3 className="text-lg font-bold text-[var(--text)]">Recent activity</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">Monitor important changes across your workspace</p>
          </div>
          <label htmlFor="timeline-search" className="relative block w-full sm:w-72">
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <span className="sr-only">Search events or users</span>
            <input
              id="timeline-search"
              aria-label="Search events or users"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search events or users"
              className="min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]"
            />
          </label>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-[var(--divider)] px-4 pt-2" aria-label="Filter activity by type">
          {filters.map((item) => {
            const count = item.id === "all"
              ? timeline.length
              : timeline.filter((event) => categoryOf(valueOf(event, "action", "Activity")) === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => {
                  setFilter(item.id);
                  setPage(1);
                }}
                className={`min-h-10 shrink-0 rounded-t-lg border-b-2 px-3 text-sm font-medium transition-colors ${filter === item.id ? "border-[var(--primary)] text-[var(--text)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"}`}
              >
                {item.label} <span className="ml-1 text-xs opacity-70">{count}</span>
              </button>
            );
          })}
        </div>

        {filteredEvents.length === 0 ? (
          <div className="grid min-h-56 place-items-center px-5 py-12 text-center">
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]"><Activity size={20} /></div>
              <h4 className="mt-3 font-semibold text-[var(--text)]">No activity found</h4>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Try another filter or search term.</p>
            </div>
          </div>
        ) : (
          <ActivityEventTable events={pageEvents} />
        )}
        <PaginationControls
          label="Activity events"
          page={currentPage}
          pageCount={pageCount}
          pageSize={PAGE_SIZE}
          total={filteredEvents.length}
          onPageChange={setPage}
        />
        <p className="border-t border-[var(--divider)] px-5 py-2 text-[11px] text-[var(--text-muted)]">
          Activity records are retained for audit purposes.
        </p>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: ReactNode;
  tone: "green" | "blue" | "violet" | "amber";
}) {
  const tones = {
    green: "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]",
    blue: "bg-[color-mix(in_srgb,var(--focus)_14%,transparent)] text-[var(--focus)]",
    violet: "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-[var(--accent)]",
    amber: "bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] text-[var(--warning)]",
  };
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        <span className={`grid h-7 w-7 place-items-center rounded-full ${tones[tone]}`}>{icon}</span>
        {label}
      </div>
      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-2xl font-bold tabular-nums text-[var(--text)]">{value.toLocaleString()}</span>
        <span className="text-xs text-[var(--text-muted)]">{detail}</span>
      </div>
    </article>
  );
}
