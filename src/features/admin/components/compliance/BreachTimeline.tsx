import { formatIst, type Update } from "./breach-types";
import { warning } from "./BreachFields";

export default function BreachTimeline({ updates }: { updates: Update[] }) {
  return (
    <section aria-labelledby="incident-timeline-heading">
      <h4 id="incident-timeline-heading" className="mb-3 font-semibold">
        Incident timeline
      </h4>
      {updates.length ? (
        <ol className="space-y-2">
          {updates.map((update) => (
            <li key={update.id} className="border-l-2 border-[var(--primary)] pl-4">
              <time className="text-xs text-[var(--text-muted)]" dateTime={update.at ?? undefined}>
                {formatIst(update.at ?? null)} IST
              </time>
              {update.statusChange && (
                <p className="text-sm font-semibold">
                  Status: {update.statusChange.replace("->", " → ")}
                </p>
              )}
              <p className="text-sm">{update.note ?? "Incident update"}</p>
              <p className={warning}>Administrator: {update.byUid ?? "Unknown"}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className={warning}>No updates recorded yet.</p>
      )}
    </section>
  );
}
