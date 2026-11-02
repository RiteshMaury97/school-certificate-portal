import { useState, type SubmitEvent } from "react";

import { inputClass, warning } from "./BreachFields";

import type { Api, Incident } from "./breach-types";

type Props = {
  incident: Incident;
  api: Api;
  act: (fn: () => Promise<void>) => Promise<void>;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
};
const allowedStatuses: Record<string, string[]> = {
  reported: ["reported", "investigating"],
  investigating: ["investigating", "contained"],
  contained: ["contained", "notified"],
  notified: ["notified"],
  closed: ["closed"],
};
export default function BreachUpdateForm({ incident, api, act, load, refresh }: Props) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState(incident.status);
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void act(async () => {
      await api("/api/admin/breaches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: incident.id,
          note,
          ...(status !== incident.status ? { status } : {}),
        }),
      });
      setNote("");
      await load();
      await refresh();
    });
  }
  const options = allowedStatuses[incident.status] ?? [incident.status];
  return (
    <section>
      <h4 className="mb-2 font-semibold">Add update or change status</h4>
      <p className={warning}>
        Notes are append-only. Do not include names or personal details of affected people.
      </p>
      <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label htmlFor="incident-update-note" className="text-sm">
          Update note
          <textarea
            aria-label="Update note"
            id="incident-update-note"
            required
            minLength={1}
            maxLength={1000}
            className={`${inputClass} min-h-20`}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
            }}
            placeholder="Example: Access token revoked and audit review started."
          />
        </label>
        <div className="flex items-end gap-2">
          <label htmlFor="incident-next-status" className="text-sm">
            Next status
            <select
              aria-label="Next status"
              id="incident-next-status"
              className={inputClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
              }}
            >
              {options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
          <button className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]">
            Add update
          </button>
        </div>
      </form>
    </section>
  );
}
