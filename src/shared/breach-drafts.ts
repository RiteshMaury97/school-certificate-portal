export type BreachDraftInput = {
  summary: string;
  cause?: string;
  dataCategories?: string[];
  systemsAffected?: string;
  discoveredAt: string | null;
  occurredAt?: string | null;
  affectedPrincipalsEstimate?: number;
  likelyConsequences?: string;
  containmentActions?: string;
};

export type DraftContact = { name?: string; email?: string; phone?: string };

function text(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function date(value: string | null | undefined): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(parsed);
}

export function generateBreachDraft(
  incident: BreachDraftInput,
  audience: "board" | "people",
  contact: DraftContact,
): string {
  const scope = incident.dataCategories?.length ? incident.dataCategories.join(", ") : "Not recorded";
  const location = text(incident.systemsAffected, "Not recorded");
  const contactDetails =
    [contact.name, contact.email, contact.phone].filter(Boolean).join(" · ") ||
    "School contact details are being confirmed.";
  return [
    audience === "board"
      ? "Draft intimation to the Data Protection Board"
      : "Draft notice to affected people",
    `What happened: ${incident.summary}`,
    `Nature and extent: ${text(incident.cause, "Not recorded")}; categories: ${scope}; estimated affected people: ${String(incident.affectedPrincipalsEstimate ?? 0)}.`,
    `Timing: occurred ${date(incident.occurredAt)}; discovered ${date(incident.discoveredAt)}.`,
    `Location / systems: ${location}.`,
    `Likely consequences: ${text(incident.likelyConsequences, "Assessment in progress.")}`,
    `Steps taken to reduce harm: ${text(incident.containmentActions, "Assessment and containment are in progress.")}`,
    "Safety steps: remain alert for unexpected messages or requests related to school records; contact the school using a known official channel if concerned.",
    `Questions: ${contactDetails}`,
  ].join("\n\n");
}
