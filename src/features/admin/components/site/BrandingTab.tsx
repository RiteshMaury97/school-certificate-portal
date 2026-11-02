import {
  useState,
  type Dispatch,
  type SubmitEvent,
  type SubmitEventHandler,
  type SetStateAction,
} from "react";
type Props = {
  branding: Record<string, string>;
  setBranding: Dispatch<SetStateAction<Record<string, string>>>;
  retentionYears: string;
  setRetentionYears: Dispatch<SetStateAction<string>>;
  backupRotationDays: string;
  setBackupRotationDays: Dispatch<SetStateAction<string>>;
  maintenanceMode: boolean;
  setMaintenanceMode: Dispatch<SetStateAction<boolean>>;
  busy: boolean;
  saveBranding: SubmitEventHandler<HTMLFormElement>;
  allowedAdminCountries: string;
  setAllowedAdminCountries: Dispatch<SetStateAction<string>>;
  adminIpAllowlist: string;
  setAdminIpAllowlist: Dispatch<SetStateAction<string>>;
  adminLocationEnforcementMode: string;
  setAdminLocationEnforcementMode: Dispatch<SetStateAction<string>>;
  recentLocationBlocks: Record<string, unknown>[];
  adminLocationExceptions: Record<string, unknown>[];
  addAdminLocationException: (input: {
    country?: string;
    adminUid?: string;
    expiresInHours: number;
    reason: string;
  }) => Promise<void>;
};
export default function BrandingTab(props: Props) {
  const {
    branding,
    setBranding,
    retentionYears,
    setRetentionYears,
    backupRotationDays,
    setBackupRotationDays,
    maintenanceMode,
    setMaintenanceMode,
    busy,
    saveBranding,
    allowedAdminCountries,
    setAllowedAdminCountries,
    adminIpAllowlist,
    setAdminIpAllowlist,
    adminLocationEnforcementMode,
    setAdminLocationEnforcementMode,
    recentLocationBlocks,
    adminLocationExceptions,
    addAdminLocationException,
  } = props;
  const [exceptionTarget, setExceptionTarget] = useState("country");
  const [exceptionCountry, setExceptionCountry] = useState("");
  const [exceptionAdminUid, setExceptionAdminUid] = useState("");
  const [exceptionHours, setExceptionHours] = useState("24");
  const [exceptionReason, setExceptionReason] = useState("");
  async function submitException(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await addAdminLocationException({
      ...(exceptionTarget === "country"
        ? { country: exceptionCountry.trim().toUpperCase() }
        : { adminUid: exceptionAdminUid.trim() }),
      expiresInHours: Number(exceptionHours),
      reason: exceptionReason.trim(),
    });
    setExceptionCountry("");
    setExceptionAdminUid("");
    setExceptionReason("");
  }
  return (
    <div className="grid gap-5">
      <section className="rounded-xl border bg-[var(--surface)] p-5">
        <h2 className="text-lg font-bold">Public site branding</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          All public school identity, principal and contact information is read from the{" "}
          <code>siteSettings/main</code> Firestore document.
        </p>
        <form onSubmit={saveBranding} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-[var(--text)]">
            Admin countries allowed (ISO codes, comma-separated)
            <input
              value={allowedAdminCountries}
              onChange={(e) => setAllowedAdminCountries(e.target.value)}
              placeholder="IN"
              className="mt-1 w-full rounded border p-2.5"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--text)]">
            Location enforcement
            <select
              value={adminLocationEnforcementMode}
              onChange={(e) => setAdminLocationEnforcementMode(e.target.value)}
              className="mt-1 w-full rounded border p-2.5"
            >
              <option value="block">Block outside policy</option>
              <option value="alert">Allow and log alerts</option>
              <option value="off">Off</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-[var(--text)] sm:col-span-2">
            School network IP allowlist (one IP or CIDR per line)
            <textarea
              value={adminIpAllowlist}
              onChange={(e) => setAdminIpAllowlist(e.target.value)}
              placeholder="203.0.113.0/24"
              rows={3}
              className="mt-1 w-full rounded border p-2.5 font-mono"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--text)]">
            Retention period after the end of the academic session (years)
            <input
              translate="no"
              type="number"
              min="1"
              max="30"
              value={retentionYears}
              onChange={(e) => {
                setRetentionYears(e.target.value);
              }}
              className="mt-1 w-full rounded border p-2.5"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--text)]">
            Encrypted backup rotation (days)
            <input
              translate="no"
              type="number"
              min="7"
              max="365"
              value={backupRotationDays}
              onChange={(e) => {
                setBackupRotationDays(e.target.value);
              }}
              className="mt-1 w-full rounded border p-2.5"
            />
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm font-semibold text-[var(--text)] sm:col-span-2">
            <input
              translate="no"
              type="checkbox"
              checked={maintenanceMode}
              onChange={(e) => {
                setMaintenanceMode(e.target.checked);
              }}
              className="h-5 w-5"
            />{" "}
            Emergency lockdown: block public lookup, verification and downloads (admin sign-in
            remains available)
          </label>
          {(
            [
              ["schoolName", "School name"],
              ["tagline", "Tagline"],
              ["boardName", "Board / affiliation name"],
              ["affiliationNumber", "Affiliation number"],
              ["schoolCode", "School code"],
              ["principalPhotoUrl", "Principal photo HTTPS URL"],
              ["principalName", "Principal name"],
              ["address", "School address"],
              ["phone", "School phone"],
              ["officeHours", "Office hours"],
              ["mapUrl", "Map link (HTTPS)"],
              ["statusPageUrl", "Public system status page (HTTPS)"],
              ["email", "School email"],
              ["jurisdiction", "Legal jurisdiction / city"],
              ["grievanceOfficerName", "Data Protection / Grievance Officer"],
              ["grievanceOfficerEmail", "Officer email"],
              ["grievanceOfficerPhone", "Officer phone"],
              ["lastUpdated", "Last updated date (display text)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm font-semibold text-[var(--text)]">
              {label}
              <input
                translate="no"
                value={branding[key] ?? ""}
                onChange={(e) => {
                  setBranding((v) => ({ ...v, [key]: e.target.value }));
                }}
                className="mt-1 w-full rounded border p-2.5"
              />
            </label>
          ))}
          <label className="text-sm font-semibold text-[var(--text)] sm:col-span-2">
            Principal&apos;s message
            <textarea
              translate="no"
              rows={5}
              maxLength={1800}
              value={branding.principalMessage}
              onChange={(e) => {
                setBranding((v) => ({
                  ...v,
                  principalMessage: e.target.value,
                }));
              }}
              className="mt-1 w-full rounded border p-2.5"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--text)] sm:col-span-2">
            Social links (one per line: Label|https://... )
            <textarea
              translate="no"
              rows={4}
              value={branding.socialLinks}
              onChange={(e) => {
                setBranding((v) => ({
                  ...v,
                  socialLinks: e.target.value,
                }));
              }}
              placeholder="Facebook|https://facebook.com/..."
              className="mt-1 w-full rounded border p-2.5"
            />
          </label>
          <button
            disabled={busy}
            aria-busy={busy}
            className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--on-primary)] sm:col-span-2"
          >
            Save site branding
          </button>
        </form>
      </section>
      <section className="rounded-xl border bg-[var(--surface)] p-5">
        <h2 className="text-lg font-bold">Temporary location exceptions</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Each exception expires within seven days and requires a reason.
        </p>
        <form
          onSubmit={(event) => {
            void submitException(event);
          }}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <label className="text-sm font-semibold">
            Exception applies to
            <select
              value={exceptionTarget}
              onChange={(e) => setExceptionTarget(e.target.value)}
              className="mt-1 w-full rounded border p-2.5"
            >
              <option value="country">A country</option>
              <option value="admin">One administrator</option>
            </select>
          </label>
          {exceptionTarget === "country" ? (
            <label className="text-sm font-semibold">
              Country code
              <input
                required
                maxLength={2}
                pattern="[A-Za-z]{2}"
                value={exceptionCountry}
                onChange={(e) => setExceptionCountry(e.target.value.toUpperCase())}
                placeholder="US"
                className="mt-1 w-full rounded border p-2.5"
              />
            </label>
          ) : (
            <label className="text-sm font-semibold">
              Administrator UID
              <input
                required
                value={exceptionAdminUid}
                onChange={(e) => setExceptionAdminUid(e.target.value)}
                className="mt-1 w-full rounded border p-2.5"
              />
            </label>
          )}
          <label className="text-sm font-semibold">
            Expires in (hours)
            <input
              required
              type="number"
              min="1"
              max="168"
              value={exceptionHours}
              onChange={(e) => setExceptionHours(e.target.value)}
              className="mt-1 w-full rounded border p-2.5"
            />
          </label>
          <label className="text-sm font-semibold">
            Reason
            <input
              required
              minLength={5}
              maxLength={500}
              value={exceptionReason}
              onChange={(e) => setExceptionReason(e.target.value)}
              className="mt-1 w-full rounded border p-2.5"
            />
          </label>
          <button
            disabled={busy}
            className="rounded-lg border px-4 py-2 font-semibold sm:col-span-2"
          >
            Add temporary exception
          </button>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {adminLocationExceptions
            .filter((item) => Date.parse(String(item.expiresAt)) > Date.now())
            .map((item) => (
              <li key={String(item.id)} className="rounded border p-3">
                {item.country
                  ? `Country ${String(item.country)}`
                  : `Admin ${String(item.adminUid)}`}{" "}
                · expires {new Date(String(item.expiresAt)).toLocaleString()} ·{" "}
                {String(item.reason)}
              </li>
            ))}
        </ul>
      </section>
      <section className="rounded-xl border bg-[var(--surface)] p-5">
        <h2 className="text-lg font-bold">Recent location blocks and alerts</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {recentLocationBlocks.length ? (
            recentLocationBlocks.map((item, index) => (
              <li key={`${String(item.action)}-${index}`} className="rounded border p-3">
                {String(item.action)} · {String(item.country)} ·{" "}
                {item.at ? new Date(String(item.at)).toLocaleString() : "time unavailable"}
              </li>
            ))
          ) : (
            <li className="text-[var(--text-muted)]">No recent location blocks or alerts.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
