import { useId } from "react";

import { DatePicker } from "@/components/ui/DatePicker";

import { inputClass, warning } from "./BreachFields";

export type QuickReportDraft = {
  title: string;
  summary: string;
  discoveredAt: string;
  occurredAt: string;
  howDiscovered: string;
  cause: string;
  severity: string;
  dataCategories: string[];
  involvesMinors: boolean;
};
type Props = {
  form: QuickReportDraft;
  set: <K extends keyof QuickReportDraft>(key: K, value: QuickReportDraft[K]) => void;
};
const categories = [
  "student-names",
  "parent-names",
  "session-and-class",
  "certificate-files",
  "contact-details",
  "admin-credentials",
  "other",
];
const causes = [
  "unauthorized-access",
  "lost-or-stolen-device",
  "misdirected-message",
  "system-error",
  "malware",
  "insider",
  "other",
];
const guidance: Record<string, string> = {
  low: "Limited impact; contained with routine action.",
  medium: "Some disruption or exposure; active follow-up is needed.",
  high: "Broad or sensitive impact; urgent coordinated response is needed.",
  critical: "Severe ongoing impact; escalate immediately to leadership.",
};

function IncidentFields({ form, set, ids }: Props & { ids: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label htmlFor={`${ids}-title`} className="text-sm font-medium">
        Short incident title *
        <input
          aria-label="Short incident title"
          id={`${ids}-title`}
          required aria-required="true"
          maxLength={160}
          className={inputClass}
          value={form.title}
          onChange={(e) => {
            set("title", e.target.value);
          }}
          placeholder="Example: Certificate files briefly accessible"
        />
        <span className={warning}>A brief label to identify this incident.</span>
      </label>
      <label htmlFor={`${ids}-how`} className="text-sm font-medium">
        How was it discovered? *
        <input
          aria-label="Discovery method"
          id={`${ids}-how`}
          required aria-required="true"
          maxLength={1000}
          className={inputClass}
          value={form.howDiscovered}
          onChange={(e) => {
            set("howDiscovered", e.target.value);
          }}
          placeholder="Example: Staff member reported an access issue"
        />
        <span className={warning}>Do not include names, phone numbers or email addresses.</span>
      </label>
      <label htmlFor={`${ids}-occurred`} className="text-sm font-medium">
        Occurred at (optional)
        <DatePicker
          label="Occurred at"
          id={`${ids}-occurred`}
          value={form.occurredAt}
          onChange={(value) => { set("occurredAt", value); }}
          includeTime
        />
        <span className={warning}>Leave empty if the time is unknown.</span>
      </label>
      <label htmlFor={`${ids}-discovered`} className="text-sm font-medium">
        Discovered at *
        <DatePicker
          label="Discovered at"
          id={`${ids}-discovered`}
          required
          value={form.discoveredAt}
          onChange={(value) => { set("discoveredAt", value); }}
          includeTime
        />
        <span className={warning}>Defaults to now; edit if needed.</span>
      </label>
      <label htmlFor={`${ids}-summary`} className="text-sm font-medium sm:col-span-2">
        What happened? *
        <textarea
          aria-label="What happened"
          id={`${ids}-summary`}
          required aria-required="true"
          minLength={10}
          maxLength={2000}
          className={`${inputClass} min-h-28 resize-y`}
          value={form.summary}
          onChange={(e) => {
            set("summary", e.target.value);
          }}
          placeholder="Example: A temporary access issue exposed one certificate folder."
        />
        <span className={warning}>
          10–2,000 characters. Never include affected people’s personal details.
        </span>
      </label>
    </div>
  );
}
function ClassificationFields({ form, set, ids }: Props & { ids: string }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label htmlFor={`${ids}-cause`} className="text-sm font-medium">
          Likely cause *
          <select
            aria-label="Likely cause"
            id={`${ids}-cause`}
            className={inputClass}
            required
            aria-required="true"
            value={form.cause}
            onChange={(e) => {
              set("cause", e.target.value);
            }}
          >
            {causes.map((cause) => (
              <option key={cause} value={cause}>
                {cause.replaceAll("-", " ")}
              </option>
            ))}
          </select>
          <span className={warning}>Choose the closest known cause; it can be updated later.</span>
        </label>
        <label htmlFor={`${ids}-severity`} className="text-sm font-medium">
          Severity *
          <select
            aria-label="Severity"
            id={`${ids}-severity`}
            className={inputClass}
            required
            aria-required="true"
            value={form.severity}
            onChange={(e) => {
              set("severity", e.target.value);
            }}
          >
            {Object.keys(guidance).map((level) => (
              <option key={level}>{level}</option>
            ))}
          </select>
          <span className={warning}>{guidance[form.severity]}</span>
        </label>
      </div>
      <fieldset className="rounded-xl border border-[var(--border)] p-4">
        <legend className="px-1 text-sm font-semibold">Data categories possibly involved</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {categories.map((category) => (
            <label
              key={category}
              htmlFor={`${ids}-category-${category}`}
              className="flex items-center gap-2 text-sm"
            >
              <input
                id={`${ids}-category-${category}`}
                aria-label={category.replaceAll("-", " ")}
                type="checkbox"
                checked={form.dataCategories.includes(category)}
                onChange={(e) => {
                  set(
                    "dataCategories",
                    e.target.checked
                      ? [...form.dataCategories, category]
                      : form.dataCategories.filter((item) => item !== category),
                  );
                }}
              />
              {category.replaceAll("-", " ")}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor={`${ids}-minors`} className="flex items-center gap-2 text-sm">
        <input
          id={`${ids}-minors`}
          aria-label="May involve minors"
          type="checkbox"
          checked={form.involvesMinors}
          onChange={(e) => {
            set("involvesMinors", e.target.checked);
          }}
        />
        May involve minors
      </label>
    </div>
  );
}
export default function BreachQuickReportFields(props: Props) {
  const ids = useId();
  return (
    <div className="space-y-4">
      <IncidentFields {...props} ids={ids} />
      <ClassificationFields {...props} ids={ids} />
    </div>
  );
}
