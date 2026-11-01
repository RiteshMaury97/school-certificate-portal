import type { AnnouncementState } from "../../types/admin-state.types";
import type { Dispatch, SubmitEventHandler, SetStateAction } from "react";
type Props = {
  announcement: AnnouncementState;
  setAnnouncement: Dispatch<SetStateAction<AnnouncementState>>;
  busy: boolean;
  saveAnnouncement: SubmitEventHandler<HTMLFormElement>;
};
export default function AnnouncementTab({
  announcement,
  setAnnouncement,
  busy,
  saveAnnouncement,
}: Props) {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
      <h2 className="text-lg font-bold">Public announcement banner</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        The notice appears at the top of the home page only during its scheduled date range. Text is
        plain text; HTML is removed.
      </p>
      <form onSubmit={saveAnnouncement} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            translate="no"
            type="checkbox"
            checked={announcement.enabled}
            onChange={(e) => {
              setAnnouncement((v) => ({
                ...v,
                enabled: e.target.checked,
              }));
            }}
            className="h-5 w-5"
          />{" "}
          Enable announcement
        </label>
        <label className="text-sm font-semibold">
          Type
          <select
            translate="no"
            value={announcement.type}
            onChange={(e) => {
              setAnnouncement((v) => ({
                ...v,
                type: e.target.value as "info" | "warning",
              }));
            }}
            className="mt-1 w-full rounded border p-2.5"
          >
            <option value="info">Information</option>
            <option value="warning">Warning</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Notice text (English)
          <textarea
            translate="no"
            required
            maxLength={240}
            rows={3}
            value={announcement.textEn}
            onChange={(e) => {
              setAnnouncement((v) => ({
                ...v,
                textEn: e.target.value,
              }));
            }}
            className="mt-1 w-full rounded border p-2.5"
          />
        </label>
        <label className="text-sm font-semibold">
          Optional HTTPS link
          <input
            translate="no"
            type="url"
            value={announcement.linkUrl}
            onChange={(e) => {
              setAnnouncement((v) => ({
                ...v,
                linkUrl: e.target.value,
              }));
            }}
            placeholder="https://..."
            className="mt-1 w-full rounded border p-2.5"
          />
        </label>
        <div className="text-xs text-[var(--text-muted)] self-end">
          The link opens in a new tab.
        </div>
        <label className="text-sm font-semibold">
          Start date and time
          <input
            translate="no"
            type="datetime-local"
            required
            value={announcement.startAt}
            onChange={(e) => {
              setAnnouncement((v) => ({
                ...v,
                startAt: e.target.value,
              }));
            }}
            className="mt-1 w-full rounded border p-2.5"
          />
        </label>
        <label className="text-sm font-semibold">
          End date and time
          <input
            translate="no"
            type="datetime-local"
            required
            value={announcement.endAt}
            onChange={(e) => {
              setAnnouncement((v) => ({
                ...v,
                endAt: e.target.value,
              }));
            }}
            className="mt-1 w-full rounded border p-2.5"
          />
        </label>
        <button
          disabled={busy}
          aria-busy={busy}
          className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--on-primary)] sm:col-span-2"
        >
          Save announcement
        </button>
      </form>
    </section>
  );
}
