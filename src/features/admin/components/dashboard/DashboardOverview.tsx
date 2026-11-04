"use client";

import { ArrowRight, FilePlus2, Upload } from "lucide-react";

import DashboardActivityPanels from "./DashboardActivityPanels";
import DashboardStatCard from "./DashboardStatCard";
import MalwareScannerStatus from "./MalwareScannerStatus";

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
  isSuperadmin: boolean;
};

function EmptyDashboardNotice({
  canManageStudents,
  onAddStudent,
  onImportRecords,
}: Pick<DashboardOverviewProps, "canManageStudents" | "onAddStudent" | "onImportRecords">) {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-5 sm:p-6">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--primary)]">
        <FilePlus2 size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-[var(--text)]">
          Your dashboard is ready for its first records
        </h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          There are no student or certificate records in the database yet. Add a student to unlock
          live activity, approvals and reporting.
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
  );
}

function StorageUsage({ stats }: { stats: DashboardStats }) {
  const formatBytes = (value: unknown) => `${(Number(value ?? 0) / (1024 * 1024)).toFixed(1)} MB`;
  return (
    <section
      aria-label="Storage usage"
      className="grid gap-3 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-4 sm:grid-cols-3"
    >
      <div>
        <p className="text-xs text-[var(--text-muted)]">R2 storage used</p>
        <p className="mt-1 font-semibold">
          {formatBytes(stats.r2StorageBytes)} / {formatBytes(stats.r2StorageBudgetBytes)}
        </p>
      </div>
      <div>
        <p className="text-xs text-[var(--text-muted)]">Uploads today</p>
        <p className="mt-1 font-semibold">{Number(stats.uploadsToday ?? 0)}</p>
      </div>
      <div>
        <p className="text-xs text-[var(--text-muted)]">Your remaining daily upload quota</p>
        <p className="mt-1 font-semibold">{formatBytes(stats.remainingUploadQuotaBytes)}</p>
      </div>
    </section>
  );
}

export default function DashboardOverview({
  stats,
  canManageStudents,
  onAddStudent,
  onImportRecords,
  isSuperadmin,
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
        <EmptyDashboardNotice
          canManageStudents={canManageStudents}
          onAddStudent={onAddStudent}
          onImportRecords={onImportRecords}
        />
      )}

      <section aria-label="School metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <DashboardStatCard key={metric.label} {...metric} />
        ))}
      </section>

      <MalwareScannerStatus isSuperadmin={isSuperadmin} />

      <StorageUsage stats={stats} />

      <DashboardActivityPanels stats={stats} feedback={feedback} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--divider)] pt-4 text-[10px] text-[var(--text-muted)]">
        <span>Administrator actions are server-authorized, CSRF-protected and audited.</span>
        <span className="uppercase tracking-wide">SIS admin · Overview</span>
      </div>
    </div>
  );
}
