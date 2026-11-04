import { Bell, CalendarClock, ExternalLink, Eye, Info, Save, TriangleAlert } from "lucide-react";

import { DatePicker } from "@/components/ui/DatePicker";

import type { AnnouncementState } from "../../types/admin-state.types";
import type { Dispatch, ReactNode, SubmitEventHandler, SetStateAction } from "react";

type Props = {
  announcement: AnnouncementState;
  setAnnouncement: Dispatch<SetStateAction<AnnouncementState>>;
  busy: boolean;
  saveAnnouncement: SubmitEventHandler<HTMLFormElement>;
};

function AnnouncementField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 text-sm font-semibold text-[var(--text)]">
      <span id={`${id}-label`} className="block">{label}</span>
      {children}
    </div>
  );
}

function updateAnnouncement<K extends keyof AnnouncementState>(
  setAnnouncement: Props["setAnnouncement"],
  key: K,
  value: AnnouncementState[K],
) {
  setAnnouncement((current) => ({ ...current, [key]: value }));
}

function isAnnouncementType(value: string): value is AnnouncementState["type"] {
  return value === "info" || value === "warning";
}

function PreviewCard({ announcement }: { announcement: AnnouncementState }) {
  const warning = announcement.type === "warning";
  const Icon = warning ? TriangleAlert : Info;
  return (
    <aside className="h-fit overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between border-b border-[var(--divider)] px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Eye size={17} className="text-[var(--primary)]" aria-hidden="true" />
          Live preview
        </div>
        <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
          Home page
        </span>
      </div>
      <div className="p-5 sm:p-6">
        <div
          className={`rounded-xl border p-4 sm:p-5 ${
            warning
              ? "border-[var(--warning)]/30 bg-[color-mix(in_srgb,var(--warning)_8%,var(--surface))]"
              : "border-[var(--primary)]/20 bg-[color-mix(in_srgb,var(--primary)_6%,var(--surface))]"
          }`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                warning
                  ? "bg-[var(--warning)]/10 text-[var(--warning)]"
                  : "bg-[var(--primary)]/10 text-[var(--primary)]"
              }`}
            >
              <Icon size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
                {warning ? "Important notice" : "School announcement"}
              </p>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text)]">
                {announcement.textEn.trim() || "Your announcement text will appear here."}
              </p>
              {announcement.linkUrl.trim() && (
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)]">
                  Learn more <ExternalLink size={13} aria-hidden="true" />
                </span>
              )}
            </div>
          </div>
        </div>
        {!announcement.enabled && (
          <p className="mt-4 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">
            Preview only. Enable the announcement to publish it during the scheduled period.
          </p>
        )}
        <div className="mt-5 flex items-start gap-2.5 text-xs leading-5 text-[var(--text-muted)]">
          <CalendarClock size={15} className="mt-0.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
          <p>
            {announcement.startAt && announcement.endAt
              ? `Scheduled from ${announcement.startAt.replace("T", " ")} until ${announcement.endAt.replace("T", " ")}.`
              : "Choose a start and end time to schedule this notice."}
          </p>
        </div>
      </div>
    </aside>
  );
}

function AnnouncementControls({
  announcement,
  setAnnouncement,
}: Pick<Props, "announcement" | "setAnnouncement">) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--divider)] bg-[var(--surface-2)]/60 p-4">
        <span>
          <span id="announcement-enabled-label" className="block text-sm font-semibold">Publish this announcement</span>
          <span className="mt-1 block text-xs text-[var(--text-muted)]">
            It will appear only within the schedule below.
          </span>
        </span>
        <input
          id="announcement-enabled"
          aria-labelledby="announcement-enabled-label"
          translate="no"
          type="checkbox"
          checked={announcement.enabled}
          onChange={(event) => {
            updateAnnouncement(setAnnouncement, "enabled", event.target.checked);
          }}
          className="h-5 w-5 accent-[var(--primary)]"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <AnnouncementField id="announcement-type" label="Notice style *">
          <select
            id="announcement-type"
            aria-labelledby="announcement-type-label"
            translate="no"
            required
            aria-required="true"
            value={announcement.type}
            onChange={(event) => {
              if (isAnnouncementType(event.target.value))
                updateAnnouncement(setAnnouncement, "type", event.target.value);
            }}
            className="min-h-11 w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-3 text-sm"
          >
            <option value="info">Information</option>
            <option value="warning">Important warning</option>
          </select>
        </AnnouncementField>
        <AnnouncementField id="announcement-link" label="Optional HTTPS link">
          <input
            id="announcement-link"
            aria-labelledby="announcement-link-label"
            translate="no"
            type="url"
            value={announcement.linkUrl}
            onChange={(event) => {
              updateAnnouncement(setAnnouncement, "linkUrl", event.target.value);
            }}
            placeholder="Enter an HTTPS URL"
            className="min-h-11 w-full rounded-xl border border-[var(--divider)] bg-[var(--surface)] px-3 text-sm"
          required aria-required="true" />
        </AnnouncementField>
      </div>

      <AnnouncementField id="announcement-text" label="Notice text (English) *">
        <textarea
          id="announcement-text"
          aria-labelledby="announcement-text-label"
          translate="no"
          required
          aria-required="true"
          minLength={1}
          maxLength={240}
          rows={5}
          value={announcement.textEn}
          onChange={(event) => {
            updateAnnouncement(setAnnouncement, "textEn", event.target.value);
          }}
          placeholder="Write a short update for students and families�"
          className="min-h-32 w-full resize-y rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-3 text-sm leading-6"
        />
        <span className="block text-right text-[11px] font-normal text-[var(--text-muted)]">
          {announcement.textEn.length}/240 characters
        </span>
      </AnnouncementField>

      <fieldset className="rounded-xl border border-[var(--divider)] p-4">
        <legend className="px-2 text-xs font-semibold text-[var(--text-muted)]">Optional translations</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["hi", "bn", "mr", "gu", "pa", "ta", "te", "ur"] as const).map((locale) => (
            <label key={locale} className="text-xs font-semibold uppercase text-[var(--text-muted)]">
              {locale}
              <textarea rows={2} maxLength={240} value={announcement.text_i18n?.[locale] ?? ""} onChange={(event) => {
                setAnnouncement((current) => ({ ...current, text_i18n: { ...current.text_i18n, [locale]: event.target.value } }));
              }} className="mt-1 w-full rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-2 text-sm font-normal normal-case text-[var(--text)]" required aria-required="true" />
            </label>
          ))}
        </div>
      </fieldset>

      <AnnouncementSchedule announcement={announcement} setAnnouncement={setAnnouncement} />
    </div>
  );
}

function AnnouncementSchedule({
  announcement,
  setAnnouncement,
}: Pick<Props, "announcement" | "setAnnouncement">) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-bold">
        <CalendarClock size={16} className="text-[var(--primary)]" aria-hidden="true" />
        Publication schedule
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <AnnouncementField id="announcement-start" label="Starts *">
          <DatePicker
            id="announcement-start"
            label="Starts"
            required
            value={announcement.startAt}
            onChange={(value) => {
              updateAnnouncement(setAnnouncement, "startAt", value);
            }}
            includeTime
          />
        </AnnouncementField>
        <AnnouncementField id="announcement-end" label="Ends">
          <DatePicker
            id="announcement-end"
            label="Ends"
            value={announcement.endAt}
            onChange={(value) => {
              updateAnnouncement(setAnnouncement, "endAt", value);
            }}
            includeTime
          />
        </AnnouncementField>
      </div>
    </div>
  );
}

export default function AnnouncementTab({
  announcement,
  setAnnouncement,
  busy,
  saveAnnouncement,
}: Props) {
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-2xl bg-[var(--primary)] px-6 py-7 text-[var(--on-primary)] shadow-[var(--shadow-card)] sm:px-8 sm:py-8">
        <div className="absolute -right-10 -top-16 h-56 w-56 rounded-full border-[28px] border-white/10" />
        <div className="relative flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/12 text-[var(--accent)]">
            <Bell size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--accent)]">
              Public communications
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Announcement center
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 opacity-85">
              Create a timely notice for your school home page, preview it as you write, and control
              exactly when it appears.
            </p>
          </div>
        </div>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.8fr)]">
        <form
          onSubmit={saveAnnouncement}
          className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-card)]"
        >
          <div className="border-b border-[var(--divider)] px-5 py-4 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-[var(--text)]">Compose announcement</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Keep notices brief, clear, and useful to families.
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
                  announcement.enabled
                    ? "bg-[color-mix(in_srgb,var(--success)_12%,var(--surface))] text-[var(--success)]"
                    : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                }`}
              >
                {announcement.enabled ? "Publishing enabled" : "Draft"}
              </span>
            </div>
          </div>

          <div className="space-y-6 p-5 sm:p-7">
            <AnnouncementControls announcement={announcement} setAnnouncement={setAnnouncement} />
            <p className="rounded-xl bg-[var(--surface-2)] px-4 py-3 text-xs leading-5 text-[var(--text-muted)]">
              Formatting is plain text. HTML is removed automatically. Any link opens in a new tab.
            </p>
            <button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 text-sm font-bold text-[var(--on-primary)] shadow-md transition hover:brightness-105 disabled:opacity-60"
            >
              <Save size={17} aria-hidden="true" />
              {busy ? "Saving announcement�" : "Save announcement"}
            </button>
          </div>
        </form>
        <PreviewCard announcement={announcement} />
      </div>
    </div>
  );
}
