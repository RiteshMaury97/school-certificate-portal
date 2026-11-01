type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
type Props = {
  retentionRecords: Record<string, unknown>[];
  retentionRetryJobs: Record<string, unknown>[];
  act: (fn: () => Promise<void>) => Promise<void>;
  api: Api;
  load: () => Promise<void>;
};
export default function RetentionTab({
  retentionRecords,
  retentionRetryJobs,
  act,
  api,
  load,
}: Props) {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
      <h2 className="text-lg font-bold">Retention review queue</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Expired records are flagged for human review only. The scheduled job never deletes records
        automatically.
      </p>
      <div className="mt-5 space-y-4">
        {retentionRetryJobs.length > 0 && (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <h3 className="font-semibold text-[var(--text)]">Erasure operations requiring retry</h3>
            <div className="mt-3 space-y-2">
              {retentionRetryJobs.map((job) => (
                <div
                  key={String(job.id)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border bg-[var(--surface)] p-3"
                >
                  <div>
                    <b className="text-sm">{String(job.id)}</b>
                    <p className="text-xs text-[var(--text-muted)]">
                      Status: retry required · {String(job.lastErrorCode ?? "")}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      void act(async () => {
                        await api("/api/admin/retention-review", {
                          method: "PATCH",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            action: "retry",
                            jobId: job.id,
                          }),
                        });
                        await load();
                      })
                    }
                    className="rounded bg-[var(--primary)] px-3 py-2 text-sm text-[var(--on-primary)]"
                  >
                    Retry erasure
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {retentionRecords.map((record) => {
          const student = (record.student ?? {}) as Record<string, unknown>;
          return (
            <article key={String(record.id)} className="rounded-lg border p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <b>{String(student.studentName ?? "Student record")}</b>
                <span className="text-xs text-[var(--text-muted)]">
                  Session {String(student.session ?? "—")} · Expired{" "}
                  {String(record.retentionExpiresAt ?? "—")}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Father: {String(student.fatherName ?? "—")} · Mother:{" "}
                {String(student.motherName ?? "—")}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const reason = prompt(
                      "Reason for extending retention (minimum 10 characters):",
                    );
                    if (!reason) return;
                    const years = Number(prompt("Extend by how many years?", "3"));
                    void act(async () => {
                      await api("/api/admin/retention-review", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          studentId: record.id,
                          action: "extend",
                          reason,
                          years,
                        }),
                      });
                      await load();
                    });
                  }}
                  className="rounded border px-3 py-2 text-sm"
                >
                  Extend retention
                </button>
                <button
                  onClick={() => {
                    const reason = prompt(
                      "Reason for dismissing this flag (minimum 10 characters):",
                    );
                    if (!reason) return;
                    void act(async () => {
                      await api("/api/admin/retention-review", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          studentId: record.id,
                          action: "dismiss",
                          reason,
                        }),
                      });
                      await load();
                    });
                  }}
                  className="rounded border px-3 py-2 text-sm"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => {
                    const confirmText = prompt(
                      "Type ERASE to permanently erase this student's data:",
                    );
                    if (confirmText !== "ERASE") return;
                    const reason = prompt(
                      "Document the legal basis / requester reason (minimum 10 characters):",
                    );
                    if (!reason) return;
                    void act(async () => {
                      await api("/api/admin/retention-review", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          studentId: record.id,
                          action: "erase",
                          confirm: "ERASE",
                          reason,
                        }),
                      });
                      await load();
                    });
                  }}
                  className="rounded bg-[var(--primary)] px-3 py-2 text-sm text-[var(--on-primary)]"
                >
                  Approve erasure
                </button>
              </div>
            </article>
          );
        })}
        {retentionRecords.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">
            No records currently require retention review.
          </p>
        )}
      </div>
    </section>
  );
}
