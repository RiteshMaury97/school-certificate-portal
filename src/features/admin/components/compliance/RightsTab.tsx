import { ArrowUpRight, CheckCheck, FileKey2, Inbox, UserRound } from "lucide-react";

import { requestInput } from "@/shared/admin-dialogs";

import type { Role } from "../../types/admin.types";
import type { Dispatch, SetStateAction } from "react";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;
type Props = {
  role: Role;
  rights: Record<string, unknown>[];
  loaded: boolean;
  resolution: Record<string, string>;
  setResolution: Dispatch<SetStateAction<Record<string, string>>>;
  resolveRight: (id: string) => Promise<void>;
  act: (fn: () => Promise<void>) => Promise<void>;
  api: Api;
  load: () => Promise<void>;
  setToast: Dispatch<SetStateAction<string>>;
};

function valueOf(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "—";
}

export default function RightsTab({
  role,
  rights,
  loaded,
  resolution,
  setResolution,
  resolveRight,
  act,
  api,
  load,
  setToast,
}: Props) {
  return (
    <main className="mx-auto max-w-6xl space-y-6 text-[var(--text)]">
      <section className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-end justify-between gap-5 bg-[var(--primary)] px-6 py-7 text-[var(--on-primary)] sm:px-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
              <FileKey2 size={15} aria-hidden="true" /> Privacy operations
            </div>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Data rights requests</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 opacity-85">
              Review requests from students and parents, document the outcome, and track each
              acknowledgment.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
            <Inbox size={18} aria-hidden="true" />
            <div>
              <p className="text-2xl font-bold leading-none">{rights.length}</p>
              <p className="mt-1 text-xs opacity-80">Open requests</p>
            </div>
          </div>
        </div>
        <div className="grid gap-px bg-[var(--divider)] sm:grid-cols-3">
          <div className="bg-[var(--surface)] p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Awaiting review
            </p>
            <p className="mt-1 text-2xl font-bold">{loaded ? rights.length : "—"}</p>
          </div>
          <div className="bg-[var(--surface)] p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Request types
            </p>
            <p className="mt-1 text-2xl font-bold">
              {
                new Set(
                  rights.map((request) => valueOf(request, "requestType", "type").toLowerCase()),
                ).size
              }
            </p>
          </div>
          <div className="bg-[var(--surface)] p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Processing</p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">
              Record actions and outcomes here
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--divider)] px-5 py-4 sm:px-6">
          <div>
            <h3 className="font-bold">Request queue</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Requests are listed for staff handling student records.
            </p>
          </div>
          <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
            {rights.length} {rights.length === 1 ? "request" : "requests"}
          </span>
        </div>
        {loaded && rights.length === 0 ? (
          <div className="grid justify-items-center px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-2)] text-[var(--primary)]">
              <CheckCheck size={22} aria-hidden="true" />
            </span>
            <h4 className="mt-4 font-semibold">You’re all caught up</h4>
            <p className="mt-1 max-w-md text-sm leading-6 text-[var(--text-muted)]">
              There are no open student or parent data rights requests right now.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--divider)]">
            {rights.map((request, index) => {
              const id = valueOf(request, "id");
              const type = valueOf(request, "requestType", "type");
              const isErasure = type.toLowerCase() === "erasure";
              return (
                <article
                  key={id === "—" ? `request-${index.toString()}` : id}
                  className="p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]">
                        <UserRound size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-bold">{type} request</h4>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${isErasure ? "bg-amber-500/10 text-amber-700" : "bg-[var(--primary)]/10 text-[var(--primary)]"}`}
                          >
                            {isErasure ? "Sensitive action" : "Open"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          Submitted by {valueOf(request, "requesterName", "name")}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-[var(--text-muted)]">
                      {valueOf(request, "acknowledgmentId", "id")}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 rounded-xl bg-[var(--surface-2)]/55 p-4 sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Student
                      </p>
                      <p className="mt-1 text-sm font-medium">{valueOf(request, "studentName")}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Contact email
                      </p>
                      <p className="mt-1 break-all text-sm font-medium">
                        {valueOf(request, "contactEmail")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Request type
                      </p>
                      <p className="mt-1 text-sm font-medium capitalize">{type}</p>
                    </div>
                  </div>

                  {valueOf(request, "description", "details") !== "—" && (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[var(--text-muted)]">
                      {valueOf(request, "description", "details")}
                    </p>
                  )}

                  <div className="mt-5 flex flex-col gap-3 border-t border-[var(--divider)] pt-4 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <p
                        id={`resolution-label-${id}`}
                        className="text-xs font-semibold text-[var(--text-muted)]"
                      >
                        Resolution notes
                      </p>
                      <textarea
                        id={`resolution-${id}`}
                        aria-labelledby={`resolution-label-${id}`}
                        translate="no"
                        required
                        aria-required="true"
                        minLength={1}
                        maxLength={2000}
                        rows={2}
                        value={resolution[id] ?? ""}
                        onChange={(event) => {
                          setResolution((current) => ({ ...current, [id]: event.target.value }));
                        }}
                        placeholder="Record the review and outcome…"
                        className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-3 py-2.5 text-sm font-normal text-[var(--text)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void resolveRight(id);
                        }}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
                      >
                        <CheckCheck size={15} aria-hidden="true" />
                        Mark resolved
                      </button>
                      {isErasure && role === "superadmin" && (
                        <button
                          type="button"
                          onClick={() => {
                            void (async () => {
                              const studentId = await requestInput({
                                title: "Verify student record",
                                description:
                                  "Use the record identifier confirmed through the approved identity-check process.",
                                label: "Student record ID",
                                required: true,
                              });
                              if (!studentId) return;
                              const confirmText = await requestInput({
                                title: "Confirm permanent erasure",
                                description: "This permanently erases the verified student’s data.",
                                label: "Type ERASE to continue",
                                required: true,
                              });
                              if (confirmText !== "ERASE") return;
                              const reason = await requestInput({
                                title: "Record erasure basis",
                                description:
                                  "Document the verified data-principal request or legal basis.",
                                label: "Reason",
                                required: true,
                                minLength: 10,
                              });
                              if (!reason) return;
                              void act(async () => {
                                const result = await api<{
                                  acknowledgmentId: string;
                                  erasureId: string;
                                }>("/api/admin/rights", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    id,
                                    studentId,
                                    action: "erase",
                                    confirm: "ERASE",
                                    reason,
                                  }),
                                });
                                setToast(
                                  `Erasure complete. Request acknowledgment: ${result.acknowledgmentId}; receipt: ${result.erasureId}`,
                                );
                                await load();
                              });
                            })();
                          }}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--danger)]/40 px-4 text-sm font-semibold text-[var(--danger)] hover:bg-[var(--danger)]/5"
                        >
                          <ArrowUpRight size={15} aria-hidden="true" />
                          Approve erasure
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
