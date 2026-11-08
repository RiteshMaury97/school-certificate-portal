import { z } from "zod";

export const breachStatuses = [
  "reported",
  "investigating",
  "contained",
  "notified",
  "closed",
] as const;
export const breachSeverityValues = ["low", "medium", "high", "critical"] as const;
export const breachCauseValues = [
  "unauthorized-access",
  "lost-or-stolen-device",
  "misdirected-message",
  "system-error",
  "malware",
  "insider",
  "other",
] as const;
export const breachDataCategories = [
  "student-names",
  "parent-names",
  "session-and-class",
  "certificate-files",
  "contact-details",
  "admin-credentials",
  "other",
] as const;

const dateValue = z.iso.datetime({ offset: true }).nullable().optional();
function hasPhoneNumber(value: string): boolean {
  const candidates = value.match(/\+?\d[\d\s().-]{7,22}\d/g) ?? [];
  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/g, "");
    return digits.length >= 9 && digits.length <= 15;
  });
}

const hasDirectPersonalData = (value: string) =>
  /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(value) ||
  hasPhoneNumber(value) ||
  /\b(?:student|parent|child|affected person)\s+(?:name|email|phone|mobile|number)\s*[:=-]/i.test(
    value,
  );
const safeText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((value) => !hasDirectPersonalData(value), {
      message: "Do not include affected people's names, phone numbers or email addresses.",
    });
const requiredText = (max: number) => safeText(1, max);
const optionalText = (max: number) => safeText(0, max).optional().default("");

export const breachFieldsSchema = z.object({
  title: requiredText(160),
  summary: safeText(10, 2000),
  occurredAt: dateValue,
  discoveredAt: z.iso.datetime({ offset: true }),
  howDiscovered: requiredText(1000),
  cause: z.enum(breachCauseValues),
  dataCategories: z.array(z.enum(breachDataCategories)).max(breachDataCategories.length),
  systemsAffected: optionalText(1000),
  affectedPrincipalsEstimate: z.number().int().min(0).max(100000000),
  involvesMinors: z.boolean(),
  severity: z.enum(breachSeverityValues),
  containmentActions: optionalText(2000),
  likelyConsequences: optionalText(2000),
  incidentLead: requiredText(128),
  status: z.enum(breachStatuses).default("reported"),
  boardNotifiedAt: dateValue,
  boardDetailedReportAt: dateValue,
  principalsNotifiedAt: dateValue,
  boardNotificationNotRequiredReason: optionalText(1000),
  affectedPeopleNotificationNotRequiredReason: optionalText(1000),
  boardDetailedReportNotRequiredReason: optionalText(1000),
  closedAt: dateValue,
  rootCause: optionalText(2000),
  correctiveActions: optionalText(2000),
  lessonsLearned: optionalText(2000),
  notificationExceptionReason: optionalText(1000),
});

export const suspectedBreachSchema = z.object({
  title: requiredText(160),
  summary: safeText(10, 2000),
  discoveredAt: z.iso.datetime({ offset: true }),
  howDiscovered: requiredText(1000),
  occurredAt: dateValue,
  cause: z.enum(breachCauseValues).optional(),
  dataCategories: z.array(z.enum(breachDataCategories)).max(breachDataCategories.length).optional(),
  severity: z.enum(breachSeverityValues).optional(),
  involvesMinors: z.boolean().optional(),
});

export const breachCreateSchema = breachFieldsSchema.refine(
  (value) => value.status === "reported",
  {
    message: "New incidents must start in reported status.",
    path: ["status"],
  },
);

export const breachUpdateSchema = z
  .object({
    id: z.string().trim().min(1).max(160),
    title: safeText(1, 160).optional(),
    summary: safeText(10, 2000).optional(),
    occurredAt: dateValue,
    discoveredAt: z.iso.datetime({ offset: true }).optional(),
    howDiscovered: requiredText(1000).optional(),
    cause: z.enum(breachCauseValues).optional(),
    dataCategories: z
      .array(z.enum(breachDataCategories))
      .max(breachDataCategories.length)
      .optional(),
    systemsAffected: safeText(0, 1000).optional(),
    affectedPrincipalsEstimate: z.number().int().min(0).max(100000000).optional(),
    involvesMinors: z.boolean().optional(),
    severity: z.enum(breachSeverityValues).optional(),
    containmentActions: safeText(0, 2000).optional(),
    likelyConsequences: safeText(0, 2000).optional(),
    incidentLead: requiredText(128).optional(),
    status: z.enum(breachStatuses).optional(),
    boardNotifiedAt: dateValue,
    boardDetailedReportAt: dateValue,
    principalsNotifiedAt: dateValue,
    boardNotificationNotRequiredReason: safeText(0, 1000).optional(),
    affectedPeopleNotificationNotRequiredReason: safeText(0, 1000).optional(),
    boardDetailedReportNotRequiredReason: safeText(0, 1000).optional(),
    closedAt: dateValue,
    rootCause: safeText(0, 2000).optional(),
    correctiveActions: safeText(0, 2000).optional(),
    lessonsLearned: safeText(0, 2000).optional(),
    notificationExceptionReason: safeText(0, 1000).optional(),
    note: safeText(1, 1000).optional(),
  })
  .refine((value) => Object.keys(value).some((key) => key !== "id"));

export type BreachFields = z.infer<typeof breachFieldsSchema>;
export type BreachStatus = (typeof breachStatuses)[number];

const nextStatus: Partial<Record<BreachStatus, BreachStatus>> = {
  reported: "investigating",
  investigating: "contained",
  contained: "notified",
  notified: "closed",
};

export function canTransitionBreach(from: unknown, to: BreachStatus): boolean {
  const status = breachStatuses.find((value) => value === from);
  if (!status || status === to) return false;
  // A case may be closed directly from any active stage once closure requirements are met.
  if (to === "closed") return true;
  return nextStatus[status] === to;
}

function hasClosureDocumentation(value: Partial<BreachFields>): boolean {
  return Boolean(
    value.rootCause?.trim() && value.correctiveActions?.trim() && value.lessonsLearned?.trim(),
  );
}

function requiresStudentNotification(value: Partial<BreachFields>): boolean {
  return (
    value.involvesMinors === true ||
    (value.dataCategories ?? []).some((category) =>
      ["student-names", "session-and-class", "certificate-files", "contact-details"].includes(
        category,
      ),
    )
  );
}

function hasNotificationRecord(value: Partial<BreachFields>): boolean {
  return (
    Boolean(value.notificationExceptionReason?.trim()) ||
    Boolean(value.boardNotifiedAt && value.principalsNotifiedAt)
  );
}

export function breachClosureError(value: Partial<BreachFields>): string | null {
  if (!hasClosureDocumentation(value)) {
    return "Root cause, corrective actions and lessons learned are required to close an incident.";
  }
  if (requiresStudentNotification(value) && !hasNotificationRecord(value)) {
    return "Record board and principal notification dates, or document why notification was not required.";
  }
  return null;
}
