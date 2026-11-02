import { useState } from "react";

import { formatIst, toIso, type Api, type Incident } from "./breach-types";
import { inputClass, warning } from "./BreachFields";

type Props = {
  incident: Incident;
  api: Api;
  act: (fn: () => Promise<void>) => Promise<void>;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
};
const fields = [
  ["boardNotifiedAt", "Board notified", "boardNotificationNotRequiredReason"],
  [
    "boardDetailedReportAt",
    "Detailed report sent to Board",
    "boardDetailedReportNotRequiredReason",
  ],
  [
    "principalsNotifiedAt",
    "Affected people notified",
    "affectedPeopleNotificationNotRequiredReason",
  ],
] as const;
export default function BreachNotificationActions({ incident, api, act, load, refresh }: Props) {
  const [dates, setDates] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  function save(field: string) {
    const selected = toIso(dates[field] ?? "");
    if (!selected) return;
    void act(async () => {
      await api("/api/admin/breaches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: incident.id, [field]: selected }),
      });
      setDates((current) => ({ ...current, [field]: "" }));
      await load();
      await refresh();
    });
  }
  return (
    <section>
      <h4 className="mb-3 font-semibold">Notification records</h4>
      <div className="grid gap-3 lg:grid-cols-3">
        {fields.map(([field, label, reasonField]) => (
          <div key={field} className="rounded-xl border border-[var(--border)] p-3">
            <label htmlFor={`notification-${field}`} className="text-sm font-medium">
              {label}
              <input
                id={`notification-${field}`}
                aria-label={label}
                type="datetime-local"
                value={dates[field] ?? ""}
                className={inputClass}
                onChange={(e) => {
                  setDates((current) => ({ ...current, [field]: e.target.value }));
                }}
              />
            </label>
            <p className={warning}>Recorded: {formatIst(incident[field])} IST</p>
            <button
              type="button"
              aria-label={`Record ${label.toLowerCase()} date and time`}
              onClick={() => {
                save(field);
              }}
              disabled={!dates[field]}
              className="mt-2 min-h-9 rounded-lg border border-[var(--border)] px-3 text-sm disabled:opacity-50"
            >
              Record actual date and time
            </button>
            <label className="mt-3 block text-xs font-medium" htmlFor={`reason-${field}`}>
              Written reason if this step is not required
              <textarea
                id={`reason-${field}`}
                className={`${inputClass} min-h-20`}
                value={reasons[reasonField] ?? incident[reasonField] ?? ""}
                maxLength={1000}
                onChange={(event) => {
                  setReasons((current) => ({ ...current, [reasonField]: event.target.value }));
                }}
              />
            </label>
            <button
              type="button"
              className="mt-2 min-h-9 rounded-lg border border-[var(--border)] px-3 text-sm"
              disabled={!reasons[reasonField]?.trim()}
              onClick={() => {
                const reason = reasons[reasonField]?.trim();
                if (!reason) return;
                void act(async () => {
                  await api("/api/admin/breaches", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: incident.id, [reasonField]: reason }),
                  });
                  await load();
                  await refresh();
                });
              }}
            >
              Save written reason
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
