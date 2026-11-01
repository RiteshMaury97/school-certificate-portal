import type { Dispatch, FormEventHandler, SetStateAction } from "react";
type Props = {
 branding: Record<string,string>; setBranding: Dispatch<SetStateAction<Record<string,string>>>;
 retentionYears: string; setRetentionYears: Dispatch<SetStateAction<string>>; retentionConfirmed: boolean; setRetentionConfirmed: Dispatch<SetStateAction<boolean>>;
 backupRotationDays: string; setBackupRotationDays: Dispatch<SetStateAction<string>>; maintenanceMode: boolean; setMaintenanceMode: Dispatch<SetStateAction<boolean>>;
 busy: boolean; saveBranding: FormEventHandler<HTMLFormElement>;
};
export default function BrandingTab(props: Props) {
 const {branding,setBranding,retentionYears,setRetentionYears,retentionConfirmed,setRetentionConfirmed,backupRotationDays,setBackupRotationDays,maintenanceMode,setMaintenanceMode,busy,saveBranding}=props;
 return (
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
                      onChange={(e) => { setRetentionYears(e.target.value); }}
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
                      onChange={(e) => { setBackupRotationDays(e.target.value); }}
                      className="mt-1 w-full rounded border p-2.5"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      translate="no"
                      type="checkbox"
                      checked={retentionConfirmed}
                      onChange={(e) => { setRetentionConfirmed(e.target.checked); }}
                      className="h-5 w-5"
                    />{" "}
                    I confirm this retention schedule has been reviewed against applicable
                    school/legal requirements
                  </label>
                  <label className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm font-semibold text-[var(--text)] sm:col-span-2">
                    <input
                      translate="no"
                      type="checkbox"
                      checked={maintenanceMode}
                      onChange={(e) => { setMaintenanceMode(e.target.checked); }}
                      className="h-5 w-5"
                    />{" "}
                    Enable public maintenance mode (staff admin pages remain available)
                  </label>
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
                        onChange={(e) => { setBranding((v) => ({ ...v, [key]: e.target.value })); }}
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
                      onChange={(e) => { setBranding((v) => ({
                          ...v,
                          principalMessage: e.target.value,
                        })); }
                      }
                      className="mt-1 w-full rounded border p-2.5"
                    />
                  </label>
                  <label className="text-sm font-semibold text-[var(--text)] sm:col-span-2">
                    Social links (one per line: Label|https://... )
                    <textarea
                      translate="no"
                      rows={4}
                      value={branding.socialLinks}
                      onChange={(e) => { setBranding((v) => ({
                          ...v,
                          socialLinks: e.target.value,
                        })); }
                      }
                      placeholder="Facebook|https://facebook.com/..."
                      className="mt-1 w-full rounded border p-2.5"
                    />
                  </label>
                  <button
                    disabled={busy} aria-busy={busy}
                    className="rounded-lg bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--on-primary)] sm:col-span-2"
                  >
                    Save site branding
                  </button>
                </form>
              </section>
 );
}
