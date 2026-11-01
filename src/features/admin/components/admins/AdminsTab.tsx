import { Clock3, Download, MoreHorizontal, Pencil, ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { useMemo, useState, type SubmitEventHandler, type Dispatch, type SetStateAction } from "react";

import type { AdminInviteProfile, AdminInviteRole } from "../../types/admin-state.types";

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
  inviteProfile: AdminInviteProfile;
  setInviteProfile: Dispatch<SetStateAction<AdminInviteProfile>>;
  invite: SubmitEventHandler<HTMLFormElement>;
  exportData: (format: "json" | "csv") => Promise<void>;
  createBackup: () => Promise<void>;
  changeRole: (uid: string, role: AdminInviteRole) => Promise<void>;
  deleteUser: (uid: string) => Promise<void>;
  act: (fn: () => Promise<void>) => Promise<void>;
  api: Api;
  load: () => Promise<void>;
};

const blankProfile: AdminInviteProfile = {
  name: "", preferredName: "", staffId: "", gender: "", dateOfBirth: "", position: "",
  department: "", designation: "", campus: "", joiningDate: "", reportingManager: "",
  officeLocation: "", alternateEmail: "", primaryPhone: "", secondaryPhone: "", address: "",
  emergencyContactName: "", emergencyContactPhone: "",
};

function profileForEdit(value: unknown): AdminInviteProfile {
  const saved = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(
    Object.keys(blankProfile).map((key) => [key, typeof saved[key] === "string" ? saved[key] : ""]),
  ) as AdminInviteProfile;
}

function StaffProfileFields({ profile, setProfile }: {
  profile: AdminInviteProfile;
  setProfile: Dispatch<SetStateAction<AdminInviteProfile>>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm">Full name *<input required minLength={2} maxLength={100} value={profile.name} onChange={(event) => { setProfile((current) => ({ ...current, name: event.target.value })); }} className="mt-1 w-full rounded border px-3 py-2" /></label>
      {([
        ["preferredName", "Preferred name", "text"], ["staffId", "Employee / Staff ID", "text"],
        ["dateOfBirth", "Date of birth", "date"], ["position", "Job title / Position", "text"],
        ["department", "Department", "text"], ["designation", "Staff designation", "text"],
        ["campus", "Campus / Branch", "text"], ["joiningDate", "Joining date", "date"],
        ["reportingManager", "Reporting manager", "text"], ["officeLocation", "Office location", "text"],
        ["alternateEmail", "Personal / alternate email", "email"], ["primaryPhone", "Primary phone", "tel"],
        ["secondaryPhone", "Secondary phone", "tel"], ["emergencyContactName", "Emergency contact name", "text"],
        ["emergencyContactPhone", "Emergency contact phone", "tel"],
      ] as const).map(([key, label, type]) => (
        <label key={key} className="text-sm">{label}<input translate="no" type={type} maxLength={key === "alternateEmail" ? 254 : key === "officeLocation" ? 160 : 120} value={profile[key]} onChange={(event) => { setProfile((current) => ({ ...current, [key]: event.target.value })); }} className="mt-1 w-full rounded border px-3 py-2" /></label>
      ))}
      <label className="text-sm">Gender<select value={profile.gender} onChange={(event) => { setProfile((current) => ({ ...current, gender: event.target.value })); }} className="mt-1 w-full rounded border px-3 py-2"><option value="">Prefer not to specify</option><option value="female">Female</option><option value="male">Male</option><option value="nonbinary">Non-binary</option><option value="prefer-not-to-say">Prefer not to say</option><option value="self-described">Self-described</option></select></label>
      <label className="text-sm sm:col-span-2 lg:col-span-3">Address<textarea maxLength={500} rows={2} value={profile.address} onChange={(event) => { setProfile((current) => ({ ...current, address: event.target.value })); }} className="mt-1 w-full rounded border px-3 py-2" /></label>
    </div>
  );
}

export default function AdminsTab({
  admins,
  adminEmail,
  setAdminEmail,
  inviteRole,
  setInviteRole,
  inviteProfile,
  setInviteProfile,
  invite,
  exportData,
  createBackup,
  changeRole,
  deleteUser,
  act,
  api,
  load,
}: AdminsTabProps) {
  const [editingUid, setEditingUid] = useState("");
  const [editProfile, setEditProfile] = useState<AdminInviteProfile>(blankProfile);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const activeCount = admins.filter((admin) => admin.status === "active").length;
  const pendingCount = admins.filter((admin) => admin.status === "invited").length;
  const disabledCount = admins.filter((admin) => admin.status === "disabled").length;
  const visibleAdmins = useMemo(() => admins.filter((admin) => {
    const profile = admin.profile && typeof admin.profile === "object" ? admin.profile as Record<string, unknown> : {};
    const query = search.trim().toLowerCase();
    const searchable = [admin.email, profile.name, profile.position, profile.staffId].some((value) => String(value ?? "").toLowerCase().includes(query));
    const matchesRole = roleFilter === "all" || String(admin.role ?? "") === roleFilter;
    return searchable && matchesRole;
  }), [admins, roleFilter, search]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">Administration / Access control</p>
          <h2 className="mt-1 text-2xl font-bold text-[var(--text)]">User management</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Create staff accounts, assign roles, and manage secure access to your school workspace.</p>
        </div>
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--primary)]">Superadmin only</span>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total staff", count: admins.length, note: "Across all campuses", Icon: Users },
          { label: "Active accounts", count: activeCount, note: "Can access workspace", Icon: UserCheck },
          { label: "Pending activation", count: pendingCount, note: "Invitation sent", Icon: Clock3 },
          { label: "Disabled accounts", count: disabledCount, note: "Access currently blocked", Icon: UserX },
        ].map(({ label, count, note, Icon }) => (
          <article key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--primary)]"><Icon size={17} /></span>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{label}</p><strong className="text-xl text-[var(--text)]">{count}</strong></div>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">{note}</p>
          </article>
        ))}
      </div>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
        <span className="mr-auto text-sm font-semibold text-[var(--text)]">Secure administration tools</span>
        <button type="button" onClick={() => { void exportData("json"); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text)]"><Download size={14} /> Export encrypted JSON</button>
        <button type="button" onClick={() => { void exportData("csv"); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text)]"><Download size={14} /> Export encrypted CSV</button>
        <button type="button" onClick={() => { void createBackup(); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3 text-xs font-semibold text-[var(--primary)]"><ShieldCheck size={14} /> Create private R2 backup</button>
      </section>

      <form onSubmit={invite} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--divider)] pb-4">
          <div><h3 className="font-bold text-[var(--text)]">Create a new staff account</h3><p className="mt-1 text-xs text-[var(--text-muted)]">The invitation includes a temporary password and verification link. Staff must set a new password before access is granted.</p></div>
          <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[10px] font-semibold uppercase text-[var(--success)]">Secure invitation</span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-xs font-medium text-[var(--text-muted)]">Official email<input translate="no" type="email" required value={adminEmail} onChange={(event) => { setAdminEmail(event.target.value); }} placeholder="Enter official school email" className="mt-1 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]" /></label>
          <label className="text-xs font-medium text-[var(--text-muted)]">Role<select translate="no" value={inviteRole} onChange={(event) => { setInviteRole(event.target.value as typeof inviteRole); }} className="mt-1 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"><option value="uploader">Uploader</option><option value="approver">Approver</option><option value="admin">Admin (uploader + approver)</option><option value="superadmin">Superadmin</option></select></label>
        </div>
        <div className="mt-3"><StaffProfileFields profile={inviteProfile} setProfile={setInviteProfile} /></div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]">Create user &amp; send invitation</button><span className="text-xs text-[var(--text-muted)]">Required fields are marked *</span></div>
      </form>

      <section className="flex flex-wrap items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--surface)] text-[var(--primary)]"><ShieldCheck size={19} /></span>
        <div><h3 className="text-sm font-bold text-[var(--text)]">Secure onboarding workflow</h3><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">1. Create the account · 2. Staff receives a one-time invitation · 3. Staff verifies their email and sets a new password · 4. Access follows the assigned role.</p><p className="mt-2 text-xs text-[var(--text-muted)]">If an invitation needs to be restarted, use the account password reset option.</p></div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--divider)] p-4">
          <div className="mr-auto"><h3 className="font-bold text-[var(--text)]">Staff accounts</h3><p className="mt-1 text-xs text-[var(--text-muted)]">Review account status, update permissions, or manage staff access.</p></div>
          <label><span className="sr-only">Search staff accounts</span><input value={search} onChange={(event) => { setSearch(event.target.value); }} placeholder="Search users" className="min-h-10 w-56 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm" /></label>
          <label><span className="sr-only">Filter by role</span><select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); }} className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"><option value="all">Filter: All roles</option><option value="uploader">Uploader</option><option value="approver">Approver</option><option value="admin">Admin</option><option value="superadmin">Superadmin</option></select></label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-[10px] uppercase tracking-wide text-[var(--text-muted)]"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Campus</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last activity</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {visibleAdmins.map((admin) => {
                const profile = admin.profile && typeof admin.profile === "object" ? admin.profile as Record<string, unknown> : {};
                const status = String(admin.status ?? "active");
                const uid = String(admin.uid);
                return <tr key={uid} className="align-top"><td className="px-4 py-3"><div className="font-semibold text-[var(--text)]">{String(profile.name ?? "Name not set")}</div><div className="mt-0.5 text-xs text-[var(--text-muted)]">{String(admin.email)}</div></td><td className="px-4 py-3"><select translate="no" aria-label={`Role for ${String(admin.email)}`} value={String(admin.role)} onChange={(event) => { void changeRole(uid, event.target.value as AdminInviteRole); }} className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs capitalize"><option value="uploader">Uploader</option><option value="approver">Approver</option><option value="admin">Admin</option><option value="superadmin">Superadmin</option></select></td><td className="px-4 py-3 text-xs text-[var(--text-muted)]">{String(profile.campus || "Not set")}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${status === "active" ? "bg-[var(--surface-2)] text-[var(--success)]" : status === "disabled" ? "bg-[var(--surface-2)] text-[var(--danger)]" : "bg-[var(--surface-2)] text-[var(--text)]"}`}>{status}</span></td><td className="px-4 py-3 text-xs text-[var(--text-muted)]">{admin.lastLoginAt ? String(admin.lastLoginAt) : status === "invited" ? "Invitation sent" : "No record"}</td><td className="px-4 py-3 text-right"><div className="inline-flex items-center gap-1"><button type="button" onClick={() => { setEditProfile(profileForEdit(admin.profile)); setEditingUid(editingUid === uid ? "" : uid); }} className="inline-flex min-h-8 items-center gap-1 rounded px-2 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-2)]"><Pencil size={13} /> Edit</button><details className="relative text-left"><summary aria-label={`More actions for ${String(admin.email)}`} className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded hover:bg-[var(--surface-2)]"><MoreHorizontal size={16} /></summary><div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg"><button type="button" onClick={() => { const disabled = status !== "disabled"; if (confirm(`${disabled ? "Disable" : "Enable"} this administrator?`)) void act(async () => { await api("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid, disabled }) }); await load(); }); }} className="w-full rounded px-3 py-2 text-left text-xs hover:bg-[var(--surface-2)]">{status === "disabled" ? "Enable account" : "Disable account"}</button><button type="button" onClick={() => { if (confirm(`Permanently delete ${String(admin.email)} and revoke their account access? This cannot be undone.`)) void deleteUser(uid); }} className="w-full rounded px-3 py-2 text-left text-xs text-[var(--danger)] hover:bg-[var(--surface-2)]">Delete user</button></div></details></div></td></tr>;
              })}
              {visibleAdmins.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">No staff accounts match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {editingUid && admins.some((admin) => String(admin.uid) === editingUid) && <form onSubmit={(event) => { event.preventDefault(); void act(async () => { await api("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid: editingUid, profile: editProfile }) }); await load(); setEditingUid(""); }); }} className="border-t border-[var(--divider)] bg-[var(--surface-2)] p-4"><div className="mb-3 flex items-center justify-between"><h4 className="font-semibold text-[var(--text)]">Edit staff profile</h4><button type="button" onClick={() => { setEditingUid(""); }} className="text-xs underline">Cancel</button></div><StaffProfileFields profile={editProfile} setProfile={setEditProfile} /><button className="mt-4 min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]">Save profile details</button></form>}
      </section>
      <p className="text-xs text-[var(--text-muted)]">Access changes are audited. Encrypted exports should be stored in an approved private location.</p>
    </div>
  );
}
