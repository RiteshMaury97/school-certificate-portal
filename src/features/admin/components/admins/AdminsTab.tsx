import type { AdminInviteRole } from "../../types/admin-state.types";
import type { FormEventHandler, Dispatch, SetStateAction } from "react";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;

type AdminsTabProps = {
  admins: Record<string, unknown>[];
  adminEmail: string;
  setAdminEmail: Dispatch<SetStateAction<string>>;
  inviteRole: AdminInviteRole;
  setInviteRole: Dispatch<SetStateAction<AdminInviteRole>>;
  invite: FormEventHandler<HTMLFormElement>;
  exportData: (format: "json" | "csv") => Promise<void>;
  createBackup: () => Promise<void>;
  changeRole: (uid: string, role: "uploader" | "approver" | "superadmin") => Promise<void>;
  act: (fn: () => Promise<void>) => Promise<void>;
  api: Api;
  load: () => Promise<void>;
};

export default function AdminsTab({
  admins,
  adminEmail,
  setAdminEmail,
  inviteRole,
  setInviteRole,
  invite,
  exportData,
  createBackup,
  changeRole,
  act,
  api,
  load,
}: AdminsTabProps) {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
      <h2 className="text-lg font-bold">Admin users (superadmin only)</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => exportData("json")} className="rounded border px-3 py-2 text-sm">Export encrypted JSON</button>
        <button onClick={() => exportData("csv")} className="rounded border px-3 py-2 text-sm">Export encrypted CSV</button>
        <button onClick={createBackup} className="rounded border px-3 py-2 text-sm">Create private R2 backup</button>
      </div>
      <form onSubmit={invite} className="mt-4 flex flex-wrap gap-2">
        <input translate="no" type="email" required value={adminEmail} onChange={(e) => { setAdminEmail(e.target.value); }} placeholder="New staff email" className="rounded border px-3 py-2" />
        <select translate="no" value={inviteRole} onChange={(e) => { setInviteRole(e.target.value as typeof inviteRole); }} className="rounded border px-3 py-2">
          <option value="uploader">Uploader</option><option value="approver">Approver</option><option value="superadmin">Superadmin</option>
        </select>
        <button className="rounded bg-[var(--primary)] px-4 py-2 text-[var(--on-primary)]">Invite admin</button>
      </form>
      <div className="mt-5 space-y-2">
        {admins.map((a) => (
          <article key={String(a.uid)} className="flex items-center justify-between rounded border p-3 text-sm">
            <span>{String(a.email)} · {String(a.role)} · {String(a.status)}</span>
            <select translate="no" aria-label={`Role for ${String(a.email)}`} value={String(a.role)} onChange={(e) => changeRole(String(a.uid), e.target.value as "uploader" | "approver" | "superadmin")} className="rounded border p-1">
              <option value="uploader">Uploader</option><option value="approver">Approver</option><option value="superadmin">Superadmin</option>
            </select>
            <button
              onClick={() => {
                const disabled = a.status !== "disabled";
                if (confirm(`${disabled ? "Disable" : "Enable"} this administrator?`))
                  act(async () => {
                    await api("/api/admin/users", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ uid: a.uid, disabled }),
                    });
                    await load();
                  });
              }}
              className="text-[var(--danger)]"
            >
              {a.status === "disabled" ? "Enable" : "Disable"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
