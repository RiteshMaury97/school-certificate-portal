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

function date(value: string | null | undefined, language: "en" | "hi"): string {
  if (!value) return language === "hi" ? "दर्ज नहीं" : "Not recorded";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return language === "hi" ? "दर्ज नहीं" : "Not recorded";
  return new Intl.DateTimeFormat(language === "hi" ? "hi-IN" : "en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(parsed);
}

export function generateBreachDraft(
  incident: BreachDraftInput,
  audience: "board" | "people",
  language: "en" | "hi",
  contact: DraftContact,
): string {
  const english = language === "en";
  const categories = incident.dataCategories;
  const scope = categories?.length ? categories.join(", ") : "Not recorded";
  const location = text(incident.systemsAffected, "Not recorded");
  const contactDetails =
    [contact.name, contact.email, contact.phone].filter(Boolean).join(" · ") ||
    (english
      ? "School contact details are being confirmed."
      : "विद्यालय संपर्क विवरण की पुष्टि की जा रही है।");
  if (english) {
    return [
      audience === "board"
        ? "Draft intimation to the Data Protection Board"
        : "Draft notice to affected people",
      `What happened: ${incident.summary}`,
      `Nature and extent: ${text(incident.cause, "Not recorded")}; categories: ${scope}; estimated affected people: ${String(incident.affectedPrincipalsEstimate ?? 0)}.`,
      `Timing: occurred ${date(incident.occurredAt, language)}; discovered ${date(incident.discoveredAt, language)}.`,
      `Location / systems: ${location}.`,
      `Likely consequences: ${text(incident.likelyConsequences, "Assessment in progress.")}`,
      `Steps taken to reduce harm: ${text(incident.containmentActions, "Assessment and containment are in progress.")}`,
      `Safety steps: remain alert for unexpected messages or requests related to school records; contact the school using a known official channel if concerned.`,
      `Questions: ${contactDetails}`,
    ].join("\n\n");
  }
  return [
    audience === "board"
      ? "डेटा संरक्षण बोर्ड को सूचना का मसौदा"
      : "प्रभावित लोगों के लिए सूचना का मसौदा",
    `क्या हुआ: ${incident.summary}`,
    `प्रकृति और विस्तार: ${text(incident.cause, "दर्ज नहीं")}; डेटा श्रेणियाँ: ${scope}; अनुमानित प्रभावित लोग: ${String(incident.affectedPrincipalsEstimate ?? 0)}।`,
    `समय: घटना ${date(incident.occurredAt, language)}; जानकारी मिली ${date(incident.discoveredAt, language)}।`,
    `स्थान / प्रणालियाँ: ${location}।`,
    `संभावित परिणाम: ${text(incident.likelyConsequences, "आकलन जारी है।")}`,
    `नुकसान कम करने के कदम: ${text(incident.containmentActions, "आकलन और रोकथाम के कदम जारी हैं।")}`,
    `सुरक्षा के कदम: विद्यालय रिकॉर्ड से जुड़े अनपेक्षित संदेशों या अनुरोधों के प्रति सतर्क रहें; चिंता होने पर विद्यालय के ज्ञात आधिकारिक माध्यम से संपर्क करें।`,
    `प्रश्नों के लिए संपर्क: ${contactDetails}`,
  ].join("\n\n");
}
