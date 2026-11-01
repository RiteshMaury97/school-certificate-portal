import type { Dispatch, SetStateAction } from "react";

type Props = {
  enquiries: Record<string, unknown>[];
  notes: Record<string, string>;
  setNotes: Dispatch<SetStateAction<Record<string, string>>>;
  update: (id: string, status: "open" | "reviewing" | "resolved" | "closed") => void;
};

function value(record: Record<string, unknown>, key: string): string {
  const field = record[key];
  if (typeof field === "string") return field;
  if (typeof field === "number" || typeof field === "boolean") return String(field);
  return "—";
}

type EnquiryStatus = "open" | "reviewing" | "resolved" | "closed";
function parseStatus(status: string): EnquiryStatus {
  return status === "reviewing" || status === "resolved" || status === "closed" ? status : "open";
}

export default function ContactEnquiriesTab({ enquiries, notes, setNotes, update }: Props) {
  return (
    <section className="rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[var(--text)]">Contact enquiries</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Messages submitted through the public contact form. Limit access to staff handling
            school enquiries.
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
          {enquiries.length} recent
        </span>
      </div>
      <div className="mt-5 space-y-4">
        {enquiries.map((enquiry) => {
          const id = value(enquiry, "id");
          return (
            <article key={id} className="rounded-xl border border-[var(--divider)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-[var(--text)]">{value(enquiry, "subject")}</h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Reference {id} · Submitted {value(enquiry, "createdAt")}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold capitalize text-[var(--text)]">
                  {value(enquiry, "status")}
                </span>
              </div>
              <dl className="mt-4 grid gap-x-5 gap-y-3 rounded-lg bg-[var(--surface-2)] p-3 text-xs sm:grid-cols-2">
                {(
                  [
                    ["Full name", "fullName"],
                    ["Mobile", "mobile"],
                    ["Email", "email"],
                    ["Enquiry type", "enquiryType"],
                    ["Student name", "studentName"],
                    ["Class / session", "classSession"],
                    ["Consent", "consent"],
                  ] as const
                ).map(([label, key]) => (
                  <div key={key}>
                    <dt className="text-[var(--text-muted)]">{label}</dt>
                    <dd className="mt-0.5 break-words font-medium text-[var(--text)]">
                      {key === "consent"
                        ? enquiry.consent === true
                          ? "Given"
                          : "Not recorded"
                        : value(enquiry, key)}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3">
                <p className="text-xs font-semibold text-[var(--text-muted)]">Message</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">
                  {value(enquiry, "message")}
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <label
                  htmlFor={`contact-enquiry-note-${id}`}
                  className="text-xs font-semibold text-[var(--text)]"
                >
                  Staff note
                  <textarea
                    aria-label="Staff note"
                    id={`contact-enquiry-note-${id}`}
                    value={notes[id] ?? value(enquiry, "adminNote")}
                    onChange={(event) => {
                      setNotes((current) => ({ ...current, [id]: event.target.value }));
                    }}
                    rows={2}
                    maxLength={2000}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
                    placeholder="Internal follow-up note"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <label
                    htmlFor={`contact-enquiry-status-${id}`}
                    className="text-xs font-semibold text-[var(--text)]"
                  >
                    Status
                    <select
                      aria-label="Enquiry status"
                      id={`contact-enquiry-status-${id}`}
                      value={value(enquiry, "status")}
                      onChange={(event) => {
                        update(id, parseStatus(event.target.value));
                      }}
                      className="mt-1 min-h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs"
                    >
                      <option value="open">Open</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      update(id, parseStatus(value(enquiry, "status")));
                    }}
                    className="min-h-10 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--on-primary)]"
                  >
                    Save note
                  </button>
                </div>
              </div>
            </article>
          );
        })}
        {enquiries.length === 0 && (
          <p className="rounded-lg bg-[var(--surface-2)] p-5 text-sm text-[var(--text-muted)]">
            No contact enquiries have been submitted.
          </p>
        )}
      </div>
    </section>
  );
}
