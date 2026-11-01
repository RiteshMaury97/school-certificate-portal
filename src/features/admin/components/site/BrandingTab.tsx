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
  emergencyLockdown: boolean;
  setEmergencyLockdown: Dispatch<SetStateAction<boolean>>;
  busy: boolean;
  saveBranding: SubmitEventHandler<HTMLFormElement>;
  allowedAdminCountries: string;
  setAllowedAdminCountries: Dispatch<SetStateAction<string>>;
  adminIpAllowlist: string;
  setAdminIpAllowlist: Dispatch<SetStateAction<string>>;
  adminEnforcementMode: string;
  setAdminEnforcementMode: Dispatch<SetStateAction<string>>;
  locationExceptions: Record<string, unknown>[];
  recentLocationBlocks: Record<string, unknown>[];
  addLocationException: (input: {
    type: "country" | "admin";
    country?: string;
    adminUid?: string;
    expiresAt: string;
    reason: string;
  }) => Promise<void>;
  removeLocationException: (id: string) => Promise<void>;
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
    emergencyLockdown,
    setEmergencyLockdown,
    busy,
    saveBranding,
    allowedAdminCountries,
    setAllowedAdminCountries,
    adminIpAllowlist,
    setAdminIpAllowlist,
    adminEnforcementMode,
    setAdminEnforcementMode,
    locationExceptions,
    recentLocationBlocks,
    addLocationException,
    removeLocationException,
  } = props;
  const [exceptionType, setExceptionType] = useState<"country" | "admin">("country");
  const [exceptionCountry, setExceptionCountry] = useState("");
  const [exceptionAdminUid, setExceptionAdminUid] = useState("");
  const [exceptionExpiry, setExceptionExpiry] = useState(() =>
    new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 16),
  );
  const [exceptionReason, setExceptionReason] = useState("");
  async function submitException(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    await addLocationException({
      type: exceptionType,
      ...(exceptionType === "country"
        ? { country: exceptionCountry }
        : { adminUid: exceptionAdminUid }),
      expiresAt: new Date(exceptionExpiry).toISOString(),
      reason: exceptionReason,
    });
    setExceptionCountry("");
    setExceptionAdminUid("");
    setExceptionReason("");
  }
  return (
    <div className="space-y-5">
      <section className="rounded-xl border bg-[var(--surface)] p-5">
        <h2 className="text-lg font-bold">Public site branding</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          All public school identity, principal and contact information is read from the{" "}
          <code>siteSettings/main</code> Firestore document.
        </p>
        <form onSubmit={saveBranding} className="mt-5 grid gap-4 sm:grid-cols-2">
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
          <label className="flex items-center gap-3 rounded-lg border-2 border-[var(--danger)]/40 bg-[var(--danger)]/5 p-4 text-sm font-bold text-[var(--text)] sm:col-span-2">
            <input
              translate="no"
              type="checkbox"
              checked={emergencyLockdown}
              onChange={(event) => {
                setEmergencyLockdown(event.target.checked);
              }}
              className="h-5 w-5"
            />
            Emergency lockdown: disable public certificate lookup, verification, and downloads
            <span className="ml-auto text-xs font-normal text-[var(--text-muted)]">
              Admin sign-in remains available
            </span>
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
            Enable public maintenance mode (staff admin pages remain available)
          </label>
          <div className="sm:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <h3 className="font-bold">Administrator location policy</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Server-side controls apply only to admin pages and APIs. Country comes from the
              trusted deployment header; IP addresses are stored as hashes in audit records.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Allowed countries (ISO codes, comma-separated)
                <input
                  value={allowedAdminCountries}
                  onChange={(event) => {
                    setAllowedAdminCountries(event.target.value);
                  }}
                  placeholder="IN"
                  className="mt-1 w-full rounded border p-2.5"
                />
              </label>
              <label className="text-sm font-semibold">
                Enforcement mode
                <select
                  value={adminEnforcementMode}
                  onChange={(event) => {
                    setAdminEnforcementMode(event.target.value);
                  }}
                  className="mt-1 w-full rounded border p-2.5"
                >
                  <option value="off">Off</option>
                  <option value="alert">Alert only</option>
                  <option value="block">Block</option>
                </select>
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                School network IP allowlist (one IPv4/IPv6 address or CIDR range per line)
                <textarea
                  rows={3}
                  value={adminIpAllowlist}
                  onChange={(event) => {
                    setAdminIpAllowlist(event.target.value);
                  }}
                  placeholder="203.0.113.0/24"
                  className="mt-1 w-full rounded border p-2.5 font-mono text-xs"
                />
              </label>
              <p className="text-xs text-[var(--text-muted)] sm:col-span-2">
                When unset, production defaults to India only with block enforcement. An allowlisted
                IP can access the admin area outside the allowed countries.
              </p>
            </div>
          </div>
          {(
            [
              ["schoolName", "School name"],
              ["tagline", "Tagline"],
              ["logoUrl", "School logo HTTPS URL"],
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
              ["includedLanguages", "Google Translate language codes (comma-separated)"],
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
          Break-glass access expires within 7 days and is recorded in the audit log.
        </p>
        <form onSubmit={submitException} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Exception applies to
            <select
              value={exceptionType}
              onChange={(event) => {
                setExceptionType(event.target.value as "country" | "admin");
              }}
              className="mt-1 w-full rounded border p-2.5"
            >
              <option value="country">Country</option>
              <option value="admin">Administrator</option>
            </select>
          </label>
          {exceptionType === "country" ? (
            <label className="text-sm font-semibold">
              Country code
              <input
                required
                maxLength={2}
                value={exceptionCountry}
                onChange={(event) => {
                  setExceptionCountry(event.target.value.toUpperCase());
                }}
                placeholder="US"
                className="mt-1 w-full rounded border p-2.5"
              />
            </label>
          ) : (
            <label className="text-sm font-semibold">
              Admin UID
              <input
                required
                value={exceptionAdminUid}
                onChange={(event) => {
                  setExceptionAdminUid(event.target.value);
                }}
                className="mt-1 w-full rounded border p-2.5"
              />
            </label>
          )}
          <label className="text-sm font-semibold">
            Expires at
            <input
              required
              type="datetime-local"
              value={exceptionExpiry}
              onChange={(event) => {
                setExceptionExpiry(event.target.value);
              }}
              className="mt-1 w-full rounded border p-2.5"
            />
          </label>
          <label className="text-sm font-semibold">
            Reason
            <textarea
              required
              minLength={8}
              maxLength={500}
              value={exceptionReason}
              onChange={(event) => {
                setExceptionReason(event.target.value);
              }}
              className="mt-1 w-full rounded border p-2.5"
            />
          </label>
          <button
            disabled={busy}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 font-semibold text-[var(--on-primary)] sm:col-span-2"
          >
            Add temporary exception
          </button>
        </form>
        <h3 className="mt-6 text-sm font-bold">Active and recent exceptions</h3>
        {locationExceptions.length ? (
          <ul className="mt-2 divide-y rounded-lg border">
            {locationExceptions.map((item) => {
              const id = String(item.id ?? "");
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs"
                >
                  <span>
                    {item.country
                      ? `Country ${String(item.country)}`
                      : `Admin ${String(item.adminUid ?? "")}`}{" "}
                    · expires{" "}
                    {item.expiresAt ? new Date(String(item.expiresAt)).toLocaleString() : "unknown"}{" "}
                    · {String(item.reason ?? "")}
                  </span>
                  {new Date(String(item.expiresAt ?? 0)).getTime() > Date.now() && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeLocationException(id)}
                      className="font-semibold text-red-700"
                    >
                      Revoke
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-muted)]">No temporary exceptions.</p>
        )}
        <h3 className="mt-6 text-sm font-bold">Recent location blocks</h3>
        {recentLocationBlocks.length ? (
          <ul className="mt-2 divide-y rounded-lg border">
            {recentLocationBlocks.map((item) => (
              <li key={String(item.id)} className="p-3 text-xs">
                {String(item.country || "Unknown country")} ·{" "}
                {String(
                  item.timestamp
                    ? new Date(String(item.timestamp)).toLocaleString()
                    : "time unavailable",
                )}{" "}
                · {String(item.reason ?? "")}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-muted)]">No recent location blocks.</p>
        )}
      </section>
    </div>
  );
}
