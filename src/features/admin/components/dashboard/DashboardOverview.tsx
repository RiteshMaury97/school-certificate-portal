"use client";

import { ArrowRight, FilePlus2, Upload } from "lucide-react";

import DashboardActivityPanels from "./DashboardActivityPanels";
import DashboardStatCard from "./DashboardStatCard";

type DashboardStats = Record<string, unknown>;
type FeedbackStats = { total?: unknown; helpful?: unknown; notHelpful?: unknown };

function isFeedbackStats(value: unknown): value is FeedbackStats {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type DashboardOverviewProps = {
  stats: DashboardStats;
  canManageStudents: boolean;
  onAddStudent: () => void;
  onImportRecords: () => void;
};

export default function DashboardOverview({
  stats,
  canManageStudents,
  onAddStudent,
  onImportRecords,
}: DashboardOverviewProps) {
  const hasRecords =
    Number(stats.totalStudents ?? 0) > 0 || Number(stats.totalCertificates ?? 0) > 0;
  const feedback = isFeedbackStats(stats.feedback) ? stats.feedback : {};
  const metrics = [
    {
      label: "Total students",
      value: stats.totalStudents,
      detail: "Across active sessions",
      tone: "green",
      icon: "users",
    },
    {
      label: "Total certificates",
      value: stats.totalCertificates,
      detail: "Issued and published",
      tone: "blue",
      icon: "certificate",
    },
    {
      label: "Pending approvals",
      value: stats.pendingApprovals,
      detail: "Waiting for review",
      tone: "amber",
      icon: "pending",
    },
    {
      label: "Searches this week",
      value: stats.searchesThisWeek,
      detail: "Public lookup activity",
      tone: "purple",
      icon: "search",
    },
    {
      label: "Failed lookups",
      value: stats.failedLookups,
      detail: "Review unusual activity",
      tone: "red",
      icon: "alert",
    },
    {
      label: "Verification checks",
      value: stats.verificationChecks,
      detail: "Certificate checks completed",
      tone: "green",
      icon: "check",
    },
    {
      label: "Open support tickets",
      value: stats.openTickets,
      detail: "Requests needing attention",
      tone: "blue",
      icon: "support",
    },
    {
      label: "Feedback responses",
      value: feedback.total,
      detail: "Public feedback received",
      tone: "purple",
      icon: "heart",
    },
    {
      label: "R2 storage used",
      value: `${(Number((stats.storage as Record<string, unknown> | undefined)?.bytes ?? 0) / 1024 ** 3).toFixed(2)} GB`,
      detail: `${Number((stats.storage as Record<string, unknown> | undefined)?.uploadsToday ?? 0)} uploads today`,
      tone: "blue",
      icon: "certificate",
    },
    {
      label: "Storage remaining",
      value: `${(Number((stats.storage as Record<string, unknown> | undefined)?.remainingBytes ?? 0) / 1024 ** 3).toFixed(2)} GB`,
      detail: "Configured R2 budget",
      tone: "green",
      icon: "check",
    },
  ] as const;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
            School overview
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--text)]">
            Your school at a glance
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            A clear view of student records, certificate activity and operations.
          </p>
        </div>
        <span className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
          All academic sessions
        </span>
      </header>

      {!hasRecords && (
        <section className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-5 sm:p-6">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--primary)]">
            <FilePlus2 size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-[var(--text)]">
              Your dashboard is ready for its first records
            </h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              There are no student or certificate records in the database yet. Add a student to
              unlock live activity, approvals and reporting.
            </p>
            {canManageStudents && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onAddStudent}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]"
                >
                  <FilePlus2 size={15} aria-hidden="true" /> Add student
                </button>
                <button
                  type="button"
                  onClick={onImportRecords}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[var(--primary)] hover:bg-[var(--surface-2)]"
                >
                  <Upload size={15} aria-hidden="true" /> Import records{" "}
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
          {!canManageStudents && (
            <p className="text-xs text-[var(--text-muted)]">
              Ask an administrator to add student records.
            </p>
          )}
        </section>
      )}

      <section aria-label="School metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <DashboardStatCard key={metric.label} {...metric} />
        ))}
      </section>

      <DashboardActivityPanels stats={stats} feedback={feedback} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--divider)] pt-4 text-[10px] text-[var(--text-muted)]">
        <span>Administrator actions are server-authorized, CSRF-protected and audited.</span>
        <span className="uppercase tracking-wide">SIS admin · Overview</span>
      </div>
    </div>
  );
}
