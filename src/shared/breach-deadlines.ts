/** Deadline settings for Rule 7 of the DPDP Rules, 2025. Review with counsel when rules change. */
export const BREACH_DEADLINES = {
  boardInitialHours: 0,
  affectedPeopleHours: 0,
  boardDetailedReportHours: 72,
  reminderHours: [24, 48, 66] as const,
} as const;

export type BreachDeadlineStep = "board-initial" | "affected-people" | "board-detailed";

export type DeadlineStatus = {
  step: BreachDeadlineStep;
  label: string;
  dueAt: Date;
  completedAt: string | null;
  remainingMs: number;
  overdue: boolean;
};

export function calculateBreachDeadlines(
  discoveredAt: string | Date | null | undefined,
  now: Date = new Date(),
  completed: Partial<Record<BreachDeadlineStep, string | null>> = {},
): DeadlineStatus[] {
  if (!discoveredAt) return [];
  const discovered = discoveredAt instanceof Date ? discoveredAt : new Date(discoveredAt);
  if (!Number.isFinite(discovered.getTime())) return [];
  const steps: readonly {
    step: BreachDeadlineStep;
    label: string;
    hours: number;
  }[] = [
    {
      step: "board-initial",
      label: "Initial Board intimation (without delay)",
      hours: BREACH_DEADLINES.boardInitialHours,
    },
    {
      step: "affected-people",
      label: "Affected people intimation (without delay)",
      hours: BREACH_DEADLINES.affectedPeopleHours,
    },
    {
      step: "board-detailed",
      label: "Detailed report to the Board",
      hours: BREACH_DEADLINES.boardDetailedReportHours,
    },
  ];
  return steps.map(({ step, label, hours }) => {
    const dueAt = new Date(discovered.getTime() + hours * 3_600_000);
    const completedAt = completed[step] ?? null;
    const remainingMs = dueAt.getTime() - now.getTime();
    return {
      step,
      label,
      dueAt,
      completedAt,
      remainingMs,
      // “Without delay” is intentionally tracked as outstanding, not assigned an invented grace period.
      overdue: step === "board-detailed" && !completedAt && remainingMs < 0,
    };
  });
}

export function dueReminderHours(discoveredAt: string | Date, now: Date): number[] {
  const discovered = discoveredAt instanceof Date ? discoveredAt : new Date(discoveredAt);
  if (!Number.isFinite(discovered.getTime())) return [];
  const elapsed = now.getTime() - discovered.getTime();
  return BREACH_DEADLINES.reminderHours.filter((hour) => elapsed >= hour * 3_600_000);
}

export function isBoardReportOverdue(
  discoveredAt: string | Date,
  now: Date,
  completedAt?: string | null,
): boolean {
  const discovered = discoveredAt instanceof Date ? discoveredAt : new Date(discoveredAt);
  return (
    !completedAt &&
    Number.isFinite(discovered.getTime()) &&
    now.getTime() > discovered.getTime() + BREACH_DEADLINES.boardDetailedReportHours * 3_600_000
  );
}
