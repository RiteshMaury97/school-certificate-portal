import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { Role } from "../../types/admin.types";

type Summary = { openCount: number; overdueCount: number };
function isSummary(value: unknown): value is Summary {
  return (
    typeof value === "object" &&
    value !== null &&
    "openCount" in value &&
    typeof value.openCount === "number" &&
    "overdueCount" in value &&
    typeof value.overdueCount === "number"
  );
}

export default function IncidentSummaryBadge({ role }: { role: Role }) {
  const [summary, setSummary] = useState<Summary>({ openCount: 0, overdueCount: 0 });
  useEffect(() => {
    if (role !== "superadmin") return;
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/admin/breaches/summary", { cache: "no-store" });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (active && isSummary(data)) setSummary(data);
      } catch (error) {
        if (error instanceof Error) return;
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [role]);
  if (role !== "superadmin" || summary.openCount === 0) return null;
  return (
    <Link
      href="/admin/breaches"
      aria-label={`${summary.openCount.toString()} open incidents, ${summary.overdueCount.toString()} overdue`}
      className={`inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold ${summary.overdueCount ? "bg-[var(--surface-2)] text-[var(--danger)]" : "bg-[var(--surface)] text-[var(--text)]"}`}
    >
      <AlertTriangle size={15} aria-hidden="true" />
      {summary.openCount.toString()} open
      {summary.overdueCount > 0 ? ` · ${summary.overdueCount.toString()} overdue` : ""}
    </Link>
  );
}
