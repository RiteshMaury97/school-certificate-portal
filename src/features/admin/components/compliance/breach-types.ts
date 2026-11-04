export type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
export type Status = "reported" | "investigating" | "contained" | "notified" | "closed";
export type Draft = {
  title: string;
  summary: string;
  occurredAt: string;
  discoveredAt: string;
  howDiscovered: string;
  cause: string;
  dataCategories: string[];
  systemsAffected: string;
  affectedPrincipalsEstimate: string;
  involvesMinors: boolean;
  severity: string;
  containmentActions: string;
  likelyConsequences: string;
  incidentLead: string;
  status: Status;
  boardNotifiedAt: string;
  boardDetailedReportAt: string;
  principalsNotifiedAt: string;
  boardNotificationNotRequiredReason: string;
  affectedPeopleNotificationNotRequiredReason: string;
  boardDetailedReportNotRequiredReason: string;
  rootCause: string;
  correctiveActions: string;
  lessonsLearned: string;
  notificationExceptionReason: string;
};
export type Incident = {
  id: string;
  title: string;
  summary: string;
  discoveredAt: string | null;
  occurredAt?: string | null;
  howDiscovered?: string;
  cause?: string;
  dataCategories?: string[];
  systemsAffected?: string;
  affectedPrincipalsEstimate?: number;
  involvesMinors?: boolean;
  severity: string;
  containmentActions?: string;
  likelyConsequences?: string;
  incidentLead?: string;
  status: string;
  boardNotifiedAt?: string | null;
  boardDetailedReportAt?: string | null;
  principalsNotifiedAt?: string | null;
  boardNotificationNotRequiredReason?: string;
  affectedPeopleNotificationNotRequiredReason?: string;
  boardDetailedReportNotRequiredReason?: string;
  closedAt?: string | null;
  rootCause?: string;
  correctiveActions?: string;
  lessonsLearned?: string;
  notificationExceptionReason?: string;
  responseTargetHours?: number;
};

function incidentDetails(value: Record<string, unknown>): Partial<Incident> {
  return {
    ...(typeof value.occurredAt === "string" || value.occurredAt === null
      ? { occurredAt: value.occurredAt }
      : {}),
    ...(typeof value.howDiscovered === "string" ? { howDiscovered: value.howDiscovered } : {}),
    ...(typeof value.cause === "string" ? { cause: value.cause } : {}),
    ...(Array.isArray(value.dataCategories)
      ? {
          dataCategories: value.dataCategories.filter(
            (item): item is string => typeof item === "string",
          ),
        }
      : {}),
    ...(typeof value.systemsAffected === "string"
      ? { systemsAffected: value.systemsAffected }
      : {}),
    ...(typeof value.involvesMinors === "boolean" ? { involvesMinors: value.involvesMinors } : {}),
    ...(typeof value.containmentActions === "string"
      ? { containmentActions: value.containmentActions }
      : {}),
    ...(typeof value.likelyConsequences === "string"
      ? { likelyConsequences: value.likelyConsequences }
      : {}),
    ...(typeof value.incidentLead === "string" ? { incidentLead: value.incidentLead } : {}),
  };
}

function incidentNotifications(value: Record<string, unknown>): Partial<Incident> {
  return {
    ...(typeof value.boardNotifiedAt === "string" || value.boardNotifiedAt === null
      ? { boardNotifiedAt: value.boardNotifiedAt }
      : {}),
    ...(typeof value.boardDetailedReportAt === "string" || value.boardDetailedReportAt === null
      ? { boardDetailedReportAt: value.boardDetailedReportAt }
      : {}),
    ...(typeof value.principalsNotifiedAt === "string" || value.principalsNotifiedAt === null
      ? { principalsNotifiedAt: value.principalsNotifiedAt }
      : {}),
    ...(typeof value.boardNotificationNotRequiredReason === "string" ? { boardNotificationNotRequiredReason: value.boardNotificationNotRequiredReason } : {}),
    ...(typeof value.affectedPeopleNotificationNotRequiredReason === "string" ? { affectedPeopleNotificationNotRequiredReason: value.affectedPeopleNotificationNotRequiredReason } : {}),
    ...(typeof value.boardDetailedReportNotRequiredReason === "string" ? { boardDetailedReportNotRequiredReason: value.boardDetailedReportNotRequiredReason } : {}),
  };
}

function incidentResolution(value: Record<string, unknown>): Partial<Incident> {
  return {
    ...(typeof value.closedAt === "string" || value.closedAt === null
      ? { closedAt: value.closedAt }
      : {}),
    ...(typeof value.rootCause === "string" ? { rootCause: value.rootCause } : {}),
    ...(typeof value.correctiveActions === "string"
      ? { correctiveActions: value.correctiveActions }
      : {}),
    ...(typeof value.lessonsLearned === "string" ? { lessonsLearned: value.lessonsLearned } : {}),
    ...(typeof value.notificationExceptionReason === "string"
      ? { notificationExceptionReason: value.notificationExceptionReason }
      : {}),
    ...(typeof value.responseTargetHours === "number"
      ? { responseTargetHours: value.responseTargetHours }
      : {}),
  };
}

export function parseIncident(value: Record<string, unknown>): Incident | null {
  if (typeof value.id !== "string") return null;
  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "Legacy breach record",
    summary: typeof value.summary === "string" ? value.summary : "",
    discoveredAt: typeof value.discoveredAt === "string" ? value.discoveredAt : null,
    severity: typeof value.severity === "string" ? value.severity : "medium",
    status: typeof value.status === "string" ? value.status : "reported",
    affectedPrincipalsEstimate:
      typeof value.affectedPrincipalsEstimate === "number" ? value.affectedPrincipalsEstimate : 0,
    ...incidentDetails(value),
    ...incidentNotifications(value),
    ...incidentResolution(value),
  };
}
export type Update = {
  id: string;
  at?: string;
  byUid?: string;
  note?: string;
  statusChange?: string | null;
};
export type Filters = {
  status: string;
  severity: string;
  start: string;
  end: string;
  search: string;
};

export const statusOptions: Status[] = [
  "reported",
  "investigating",
  "contained",
  "notified",
  "closed",
];
export const emptyDraft = (): Draft => ({
  title: "",
  summary: "",
  occurredAt: "",
  discoveredAt: "",
  howDiscovered: "",
  cause: "other",
  dataCategories: [],
  systemsAffected: "",
  affectedPrincipalsEstimate: "0",
  involvesMinors: false,
  severity: "medium",
  containmentActions: "",
  likelyConsequences: "",
  incidentLead: "",
  status: "reported",
  boardNotifiedAt: "",
  boardDetailedReportAt: "",
  principalsNotifiedAt: "",
  boardNotificationNotRequiredReason: "",
  affectedPeopleNotificationNotRequiredReason: "",
  boardDetailedReportNotRequiredReason: "",
  rootCause: "",
  correctiveActions: "",
  lessonsLearned: "",
  notificationExceptionReason: "",
});

export function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
export function formatIst(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
export function localDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function isStatus(value: unknown): value is Status {
  return statusOptions.some((status) => status === value);
}
