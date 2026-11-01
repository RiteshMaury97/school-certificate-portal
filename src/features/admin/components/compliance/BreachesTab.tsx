type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
type Props = {
  breaches: Record<string, unknown>[];
  loaded: boolean;
  act: (fn: () => Promise<void>) => Promise<void>;
  api: Api;
  load: () => Promise<void>;
};
export default function BreachesTab({ breaches, loaded, act, api, load }: Props) {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
      <h2 className="text-lg font-bold">Personal data breach register</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Record suspected or confirmed incidents immediately. This log does not itself send statutory
        notifications; the incident lead must follow the approved notification procedure.
      </p>
      <button
        onClick={() => {
          const summary = prompt("Incident summary (no unnecessary personal data)");
          if (!summary) return;
          const affectedData = prompt("Categories of data affected");
          if (!affectedData) return;
          const estimate = Number(prompt("Estimated number of affected people", "0") ?? "0");
          if (!Number.isFinite(estimate) || estimate < 0) return;
          act(async () => {
            await api("/api/admin/breaches", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                summary,
                affectedData,
                affectedPrincipalsEstimate: estimate,
                discoveredAt: new Date().toISOString(),
                status: "investigating",
              }),
            });
            await load();
          });
        }}
        className="mt-4 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)]"
      >
        Record incident
      </button>
      <div className="mt-5 space-y-3">
        {loaded && breaches.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            No data found. No incidents have been recorded.
          </p>
        )}
        {breaches.map((b) => (
          <article key={String(b.id)} className="rounded-lg border p-4">
            <p className="font-semibold">{String(b.summary ?? "Incident")}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Discovered: {String(b.discoveredAt ?? "")} · Status: {String(b.status ?? "")}
            </p>
            <p className="text-sm">
              Affected data: {String(b.affectedData ?? "")} · Estimated people:{" "}
              {String(b.affectedPrincipalsEstimate ?? "")}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Board initial notice: {String(b.boardNotifiedAt ?? "Not recorded")} · Board detailed
              report: {String(b.boardDetailedReportAt ?? "Not recorded")} · People notified:{" "}
              {String(b.principalsNotifiedAt ?? "Not recorded")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  act(async () => {
                    await api("/api/admin/breaches", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: String(b.id),
                        boardNotifiedAt: new Date().toISOString(),
                        status: "notified",
                      }),
                    });
                    await load();
                  })
                }
                className="rounded border px-3 py-1.5 text-xs"
              >
                Record Board notification
              </button>
              <button
                onClick={() =>
                  act(async () => {
                    await api("/api/admin/breaches", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: String(b.id),
                        boardDetailedReportAt: new Date().toISOString(),
                        status: "notified",
                      }),
                    });
                    await load();
                  })
                }
                className="rounded border px-3 py-1.5 text-xs"
              >
                Record Board detailed report
              </button>
              <button
                onClick={() =>
                  act(async () => {
                    await api("/api/admin/breaches", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: String(b.id),
                        principalsNotifiedAt: new Date().toISOString(),
                        status: "notified",
                      }),
                    });
                    await load();
                  })
                }
                className="rounded border px-3 py-1.5 text-xs"
              >
                Record affected people notified
              </button>
              <button
                onClick={() =>
                  act(async () => {
                    await api("/api/admin/breaches", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: String(b.id),
                        status: "closed",
                      }),
                    });
                    await load();
                  })
                }
                className="rounded border px-3 py-1.5 text-xs"
              >
                Close incident
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
