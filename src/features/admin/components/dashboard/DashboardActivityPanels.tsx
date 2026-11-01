import { Activity, HeartHandshake } from "lucide-react";

import EmptyState from "@/components/feedback/EmptyState";

import type { ReactNode } from "react";

type ActivityItem = { session: string; value: number };
type Props = {
  stats: Record<string, unknown>;
  feedback: { total?: unknown; helpful?: unknown; notHelpful?: unknown };
};

function parseCertificates(value: unknown): ActivityItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item: unknown): item is { session: string; count: number } =>
        typeof item === "object" &&
        item !== null &&
        "session" in item &&
        typeof item.session === "string" &&
        "count" in item &&
        typeof item.count === "number",
    )
    .map((item) => ({ session: item.session, value: item.count }));
}

function parseDownloads(value: unknown): ActivityItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item: unknown): item is { session: string; downloads: number } =>
        typeof item === "object" &&
        item !== null &&
        "session" in item &&
        typeof item.session === "string" &&
        "downloads" in item &&
        typeof item.downloads === "number",
    )
    .map((item) => ({ session: item.session, value: item.downloads }));
}

function SessionBars({ items }: { items: ActivityItem[] }) {
  if (items.length === 0)
    return (
      <EmptyState
        title="No activity yet"
        description="Activity will appear here when records are available."
      />
    );
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const value = item.value;
        return (
          <div
            key={item.session}
            className="grid grid-cols-[5rem_1fr_2rem] items-center gap-3 text-xs"
          >
            <b className="text-[var(--text)]">{item.session}</b>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--primary)]"
                style={{ width: `${String((value / max) * 100)}%` }}
              />
            </div>
            <span className="text-right tabular-nums text-[var(--text-muted)]">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

function ActivityCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: "activity" | "downloads";
  children: ReactNode;
}) {
  const Icon = icon === "activity" ? Activity : HeartHandshake;
  return (
    <article className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--primary)]">
          <Icon size={16} aria-hidden="true" />
        </span>
        <div>
          <h3 className="font-semibold text-[var(--text)]">{title}</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </article>
  );
}

export default function DashboardActivityPanels({ stats, feedback }: Props) {
  const certificates = parseCertificates(stats.certificatesPerSession);
  const downloads = parseDownloads(stats.downloadsPerSession);
  const total = typeof feedback.total === "number" ? feedback.total : 0;
  const helpful = typeof feedback.helpful === "number" ? feedback.helpful : 0;
  const notHelpful = typeof feedback.notHelpful === "number" ? feedback.notHelpful : 0;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ActivityCard
        title="Published certificates"
        subtitle="Certificate volume by academic session"
        icon="activity"
      >
        <SessionBars items={certificates} />
      </ActivityCard>
      <ActivityCard
        title="Certificate downloads"
        subtitle="Successful downloads by academic session"
        icon="downloads"
      >
        <SessionBars items={downloads} />
      </ActivityCard>
      <article className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm xl:col-span-1">
        <h3 className="font-semibold text-[var(--text)]">Public feedback</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Feedback trends from portal visitors.
        </p>
        {total === 0 ? (
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            No responses received yet. Feedback summaries will appear here.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5">
              {total} responses
            </span>
            <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-emerald-800">
              {helpful} helpful
            </span>
            <span className="rounded-full bg-rose-100 px-3 py-1.5 text-rose-800">
              {notHelpful} not helpful
            </span>
          </div>
        )}
      </article>
      <article className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm xl:col-span-1">
        <h3 className="font-semibold text-[var(--text)]">Operational health</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Core administration protections.</p>
        <div className="mt-4 flex items-center gap-2 text-sm font-medium text-[var(--text)]">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> Admin services responding
        </div>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Authentication <span className="px-1">·</span> Audit logging{" "}
          <span className="px-1">·</span> CSRF protection
        </p>
      </article>
    </div>
  );
}
