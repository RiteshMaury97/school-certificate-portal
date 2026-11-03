import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  MessageSquareText,
  Phone,
  Search,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";

import type { Dispatch, SetStateAction } from "react";

type Props = {
  enquiries: Record<string, unknown>[];
  notes: Record<string, string>;
  setNotes: Dispatch<SetStateAction<Record<string, string>>>;
  update: (
    id: string,
    status: "open" | "reviewing" | "resolved" | "closed",
    reply?: string,
  ) => void;
};

type EnquiryStatus = "open" | "reviewing" | "resolved" | "closed";
type StatusFilter = "all" | EnquiryStatus;

function value(record: Record<string, unknown>, key: string): string {
  const field = record[key];
  if (typeof field === "string" && field.trim()) return field.trim();
  if (typeof field === "number" || typeof field === "boolean") return String(field);
  return "—";
}

function parseStatus(status: string): EnquiryStatus {
  return status === "reviewing" || status === "resolved" || status === "closed" ? status : "open";
}

function dateLabel(raw: string): string {
  const date = new Date(raw);
  if (raw === "—" || Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    date,
  );
}

function statusClass(status: EnquiryStatus): string {
  if (status === "resolved" || status === "closed") return "bg-emerald-500/10 text-emerald-700";
  if (status === "reviewing") return "bg-amber-500/10 text-amber-700";
  return "bg-sky-500/10 text-sky-700";
}

export default function ContactEnquiriesTab({ enquiries, notes, setNotes, update }: Props) {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const counts = useMemo(
    () => ({
      all: enquiries.length,
      open: enquiries.filter((item) => parseStatus(value(item, "status")) === "open").length,
      reviewing: enquiries.filter((item) => parseStatus(value(item, "status")) === "reviewing")
        .length,
      resolved: enquiries.filter((item) =>
        ["resolved", "closed"].includes(parseStatus(value(item, "status"))),
      ).length,
    }),
    [enquiries],
  );
  const visibleEnquiries = enquiries.filter((item) => {
    const status = parseStatus(value(item, "status"));
    const matchesStatus =
      filter === "all" || status === filter || (filter === "resolved" && status === "closed");
    const searchText = ["subject", "fullName", "email", "mobile", "studentName", "message", "id"]
      .map((key) => value(item, key))
      .join(" ")
      .toLowerCase();
    return matchesStatus && searchText.includes(query.trim().toLowerCase());
  });

  return (
    <main className="mx-auto max-w-6xl space-y-6 text-[var(--text)]">
      <section className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-end justify-between gap-5 bg-[var(--primary)] px-6 py-7 text-[var(--on-primary)] sm:px-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-80">
              <MessageSquareText size={15} aria-hidden="true" /> Public inbox
            </div>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Contact enquiries</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 opacity-85">
              Manage messages sent through the school contact form. Keep personal details limited to
              staff handling enquiries.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3">
            <Inbox size={18} aria-hidden="true" />
            <div>
              <p className="text-2xl font-bold leading-none">{counts.open + counts.reviewing}</p>
              <p className="mt-1 text-xs opacity-80">Need attention</p>
            </div>
          </div>
        </div>
        <div className="grid gap-px bg-[var(--divider)] sm:grid-cols-3">
          <div className="bg-[var(--surface)] p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">All received</p>
            <p className="mt-1 text-2xl font-bold">{counts.all}</p>
          </div>
          <div className="bg-[var(--surface)] p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Open / reviewing
            </p>
            <p className="mt-1 text-2xl font-bold">{counts.open + counts.reviewing}</p>
          </div>
          <div className="bg-[var(--surface)] p-5">
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Completed</p>
            <p className="mt-1 text-2xl font-bold">{counts.resolved}</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--divider)] px-5 py-4 sm:px-6">
          <div>
            <h3 className="font-bold">Enquiry queue</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Review messages and record staff follow-up.
            </p>
          </div>
          <div className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-[var(--divider)] bg-[var(--surface-2)]/50 px-3 text-[var(--text-muted)] sm:max-w-xs">
            <Search size={15} aria-hidden="true" />
            <span id="enquiry-search-label" className="sr-only">
              Search enquiries
            </span>
            <input
              id="enquiry-search"
              aria-labelledby="enquiry-search-label"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search enquiries"
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
            />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-[var(--divider)] px-5 py-3 sm:px-6">
          {(["all", "open", "reviewing", "resolved"] as const).map((item) => {
            const label =
              item === "all" ? "All enquiries" : item === "resolved" ? "Completed" : item;
            const count =
              item === "all"
                ? counts.all
                : item === "open"
                  ? counts.open
                  : item === "reviewing"
                    ? counts.reviewing
                    : counts.resolved;
            return (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setFilter(item);
                }}
                aria-pressed={filter === item}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold capitalize transition ${filter === item ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"}`}
              >
                {label} <span className="ml-1 opacity-75">{count}</span>
              </button>
            );
          })}
        </div>
        {visibleEnquiries.length === 0 ? (
          <div className="grid justify-items-center px-6 py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--surface-2)] text-[var(--primary)]">
              <CheckCircle2 size={22} aria-hidden="true" />
            </span>
            <h4 className="mt-4 font-semibold">
              {enquiries.length === 0 ? "Inbox is clear" : "No matching enquiries"}
            </h4>
            <p className="mt-1 max-w-md text-sm leading-6 text-[var(--text-muted)]">
              {enquiries.length === 0
                ? "New messages submitted through the public contact form will appear here."
                : "Try another status filter or search term."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--divider)]">
            {visibleEnquiries.map((enquiry, index) => {
              const id = value(enquiry, "id");
              const status = parseStatus(value(enquiry, "status"));
              const email = value(enquiry, "email");
              const phone = value(enquiry, "mobile");
              return (
                <article
                  key={id === "—" ? `enquiry-${index.toString()}` : id}
                  className="p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]">
                        <UserRound size={18} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="break-words font-bold">{value(enquiry, "subject")}</h4>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${statusClass(status)}`}
                          >
                            {status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--text-muted)]">
                          {value(enquiry, "fullName")} <span className="px-1">·</span> Ref {id}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <Clock3 size={13} aria-hidden="true" />
                      {dateLabel(value(enquiry, "createdAt"))}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3 rounded-xl bg-[var(--surface-2)]/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Email
                      </p>
                      <a
                        href={email === "—" ? undefined : `mailto:${email}`}
                        className="mt-1 inline-flex items-center gap-1.5 break-all text-sm font-medium text-[var(--primary)] hover:underline"
                      >
                        <Mail size={13} aria-hidden="true" />
                        {email}
                      </a>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Mobile
                      </p>
                      <a
                        href={phone === "—" ? undefined : `tel:${phone}`}
                        className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text)]"
                      >
                        <Phone size={13} aria-hidden="true" />
                        {phone}
                      </a>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Enquiry type
                      </p>
                      <p className="mt-1 text-sm font-medium capitalize">
                        {value(enquiry, "enquiryType")}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Student
                      </p>
                      <p className="mt-1 text-sm font-medium">{value(enquiry, "studentName")}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Class / session
                      </p>
                      <p className="mt-1 text-sm font-medium">{value(enquiry, "classSession")}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        Consent
                      </p>
                      <p className="mt-1 text-sm font-medium">
                        {enquiry.consent === true ? "Given" : "Not recorded"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-[var(--divider)] px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Message
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                      {value(enquiry, "message")}
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 border-t border-[var(--divider)] pt-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                    <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
                      <div className="flex-1">
                        <p
                          id={`contact-enquiry-note-label-${id}`}
                          className="text-xs font-semibold text-[var(--text-muted)]"
                        >
                          Internal staff note
                        </p>
                        <textarea
                          id={`contact-enquiry-note-${id}`}
                          aria-labelledby={`contact-enquiry-note-label-${id}`}
                          value={notes[id] ?? value(enquiry, "adminNote")}
                          onChange={(event) => {
                            setNotes((current) => ({ ...current, [id]: event.target.value }));
                          }}
                          rows={2}
                          maxLength={2000}
                          className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-3 py-2.5 text-sm font-normal text-[var(--text)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
                          placeholder="Add internal follow-up context…"
                        />
                      </div>
                      <div>
                        <p
                          id={`contact-enquiry-reply-label-${id}`}
                          className="text-xs font-semibold text-[var(--text-muted)]"
                        >
                          Email response to {email}
                        </p>
                        <textarea
                          id={`contact-enquiry-reply-${id}`}
                          aria-labelledby={`contact-enquiry-reply-label-${id}`}
                          value={replies[id] ?? ""}
                          onChange={(event) => {
                            setReplies((current) => ({ ...current, [id]: event.target.value }));
                          }}
                          rows={2}
                          maxLength={3000}
                          className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--primary)]"
                          placeholder="Write a response to email…"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div>
                        <span
                          id={`contact-enquiry-status-label-${id}`}
                          className="text-xs font-semibold text-[var(--text-muted)]"
                        >
                          Update status
                        </span>
                        <select
                          aria-labelledby={`contact-enquiry-status-label-${id}`}
                          id={`contact-enquiry-status-${id}`}
                          required
                          aria-required="true"
                          value={status}
                          onChange={(event) => {
                            update(id, parseStatus(event.target.value));
                          }}
                          className="mt-1.5 block min-h-10 rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--text)]"
                        >
                          <option value="open">Open</option>
                          <option value="reviewing">Reviewing</option>
                          <option value="resolved">Resolved</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          update(id, status);
                        }}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--divider)] px-4 text-sm font-semibold hover:bg-[var(--surface-2)]"
                      >
                        Save note
                      </button>
                      <button
                        type="button"
                        disabled={!replies[id]?.trim() || email === "—"}
                        onClick={() => {
                          update(id, status, replies[id]);
                        }}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50"
                      >
                        Send email response <ArrowUpRight size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <p className="text-xs leading-5 text-[var(--text-muted)]">
        Enquiry details contain personal information. Share access only with staff who need it to
        respond.
      </p>
    </main>
  );
}
