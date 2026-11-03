import { MoreHorizontal, Pencil, ShieldCheck } from "lucide-react";
import {
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
  type SubmitEventHandler,
} from "react";
import { confirmAction } from "@/shared/admin-dialogs";

import {
  AdminTools,
  AdminSummary,
  blankProfile,
  EditProfileForm,
  InviteForm,
  isAdminInviteRole,
  profileForEdit,
} from "./AdminProfileForms";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function OnboardingNote() {
  return (
    <section className="flex flex-wrap items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--surface)] text-[var(--primary)]">
        <ShieldCheck size={19} />
      </span>
      <div>
        <h3 className="text-sm font-bold text-[var(--text)]">Secure onboarding workflow</h3>
        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
          1. Create the account · 2. Staff receives a one-time invitation · 3. Staff verifies their
          email and sets a new password · 4. Access follows the assigned role.
        </p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          If an invitation needs to be restarted, use the account password reset option.
        </p>
      </div>
    </section>
  );
}

function AdminFilters({
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
}: {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  roleFilter: string;
  setRoleFilter: Dispatch<SetStateAction<string>>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--divider)] p-4">
      <div className="mr-auto">
        <h3 className="font-bold text-[var(--text)]">Staff accounts</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          Review account status, update permissions, or manage staff access.
        </p>
      </div>
      <label htmlFor="admin-search" className="min-h-10 w-56">
        <span className="sr-only">Search staff accounts</span>
        <input
          id="admin-search"
          aria-label="Search staff accounts"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder="Search users"
          className="min-h-10 w-56 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
        />
      </label>
      <label htmlFor="admin-role-filter">
        <span className="sr-only">Filter by role</span>
        <select
          id="admin-role-filter"
          value={roleFilter}
          onChange={(event) => {
            setRoleFilter(event.target.value);
          }}
          className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
        >
          <option value="all">Filter: All roles</option>
          <option value="uploader">Uploader</option>
          <option value="approver">Approver</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
      </label>
    </div>
  );
}

type AdminRowProps = {
  admin: Record<string, unknown>;
  editingUid: string;
  setEditingUid: Dispatch<SetStateAction<string>>;
  setEditProfile: Dispatch<SetStateAction<AdminInviteProfile>>;
  changeRole: AdminsTabProps["changeRole"];
  deleteUser: AdminsTabProps["deleteUser"];
  act: AdminsTabProps["act"];
  api: Api;
  load: AdminsTabProps["load"];
};

function AdminRow({
  admin,
  editingUid,
  setEditingUid,
  setEditProfile,
  changeRole,
  deleteUser,
  act,
  api,
  load,
}: AdminRowProps) {
  const profile = isRecord(admin.profile) ? admin.profile : {};
  const uid = stringValue(admin.uid);
  const email = stringValue(admin.email, "Unknown email");
  const status = stringValue(admin.status, "active");
  const role = stringValue(admin.role);
  const lastLogin = stringValue(admin.lastLoginAt);
  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="font-semibold text-[var(--text)]">
          {stringValue(profile.name, "Name not set")}
        </div>
        <div className="mt-0.5 text-xs text-[var(--text-muted)]">{email}</div>
      </td>
      <td className="px-4 py-3">
        <select
          translate="no"
          aria-label={`Role for ${email}`}
          required
          aria-required="true"
          value={isAdminInviteRole(role) ? role : "uploader"}
          onChange={(event) => {
            if (isAdminInviteRole(event.target.value)) void changeRole(uid, event.target.value);
          }}
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs capitalize"
        >
          <option value="uploader">Uploader</option>
          <option value="approver">Approver</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
        {stringValue(profile.campus, "Not set") || "Not set"}
      </td>
      <td className="px-4 py-3">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${status === "active" ? "bg-[var(--surface-2)] text-[var(--success)]" : status === "disabled" ? "bg-[var(--surface-2)] text-[var(--danger)]" : "bg-[var(--surface-2)] text-[var(--text)]"}`}
        >
          {status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
        {lastLogin || (status === "invited" ? "Invitation sent" : "No record")}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            aria-label={`Edit profile for ${email}`}
            onClick={() => {
              setEditProfile(profileForEdit(admin.profile));
              setEditingUid(editingUid === uid ? "" : uid);
            }}
            className="inline-flex min-h-8 items-center gap-1 rounded px-2 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-2)]"
          >
            <Pencil size={13} /> Edit
          </button>
          <details className="relative text-left">
            <summary
              aria-label={`More actions for ${email}`}
              className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded hover:bg-[var(--surface-2)]"
            >
              <MoreHorizontal size={16} />
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  const disabled = status !== "disabled";
                  void confirmAction(
                    `${disabled ? "Disable" : "Enable"} administrator`,
                    `This will ${disabled ? "disable" : "enable"} ${email}.`,
                  ).then((accepted) => {
                    if (accepted)
                      void act(async () => {
                        await api("/api/admin/users", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ uid, disabled }),
                        });
                        await load();
                      });
                  });
                }}
                className="w-full rounded px-3 py-2 text-left text-xs hover:bg-[var(--surface-2)]"
              >
                {status === "disabled" ? "Enable account" : "Disable account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void confirmAction(
                    "Delete administrator",
                    `Permanently delete ${email} and revoke their account access? This cannot be undone.`,
                    "Delete administrator",
                  ).then((accepted) => {
                    if (accepted) void deleteUser(uid);
                  });
                }}
                className="w-full rounded px-3 py-2 text-left text-xs text-[var(--danger)] hover:bg-[var(--surface-2)]"
              >
                Delete user
              </button>
            </div>
          </details>
        </div>
      </td>
    </tr>
  );
}

function AdminTable(
  props: Omit<AdminRowProps, "admin"> & {
    admins: Record<string, unknown>[];
    visibleAdmins: Record<string, unknown>[];
  },
) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-[var(--surface-2)] text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Campus</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Last activity</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--divider)]">
            {props.visibleAdmins.map((admin) => (
              <AdminRow key={stringValue(admin.uid)} admin={admin} {...props} />
            ))}
            {props.visibleAdmins.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                  No staff accounts match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StaffAccounts({
  props,
  admins,
  visibleAdmins,
  editingUid,
  setEditingUid,
  editProfile,
  setEditProfile,
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
}: {
  props: Pick<AdminsTabProps, "changeRole" | "deleteUser" | "act" | "api" | "load">;
  admins: Record<string, unknown>[];
  visibleAdmins: Record<string, unknown>[];
  editingUid: string;
  setEditingUid: Dispatch<SetStateAction<string>>;
  editProfile: AdminInviteProfile;
  setEditProfile: Dispatch<SetStateAction<AdminInviteProfile>>;
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  roleFilter: string;
  setRoleFilter: Dispatch<SetStateAction<string>>;
}) {
  const rowProps = { ...props, editingUid, setEditingUid, setEditProfile };
  const canEdit = editingUid && admins.some((admin) => stringValue(admin.uid) === editingUid);
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <AdminFilters
        search={search}
        setSearch={setSearch}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
      />
      <AdminTable {...rowProps} admins={admins} visibleAdmins={visibleAdmins} />
      {canEdit && (
        <EditProfileForm
          uid={editingUid}
          profile={editProfile}
          setProfile={setEditProfile}
          act={props.act}
          api={props.api}
          load={props.load}
          onClose={() => {
            setEditingUid("");
          }}
        />
      )}
    </section>
  );
}

export default function AdminsTab(props: AdminsTabProps) {
  const [editingUid, setEditingUid] = useState("");
  const [editProfile, setEditProfile] = useState<AdminInviteProfile>(blankProfile);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const visibleAdmins = useMemo(
    () =>
      props.admins.filter((admin) => {
        const profile = isRecord(admin.profile) ? admin.profile : {};
        const query = search.trim().toLowerCase();
        const searchable = [admin.email, profile.name, profile.position, profile.staffId].some(
          (value) => stringValue(value).toLowerCase().includes(query),
        );
        const role = stringValue(admin.role);
        return searchable && (roleFilter === "all" || role === roleFilter);
      }),
    [props.admins, roleFilter, search],
  );
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--primary)]">
            Administration / Access control
          </p>
          <h2 className="mt-1 text-2xl font-bold text-[var(--text)]">User management</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Create staff accounts, assign roles, and manage secure access to your school workspace.
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--primary)]">
          Superadmin only
        </span>
      </header>
      <AdminSummary admins={props.admins} />
      <AdminTools exportData={props.exportData} createBackup={props.createBackup} />
      <InviteForm {...props} />
      <OnboardingNote />
      <StaffAccounts
        props={props}
        admins={props.admins}
        visibleAdmins={visibleAdmins}
        editingUid={editingUid}
        setEditingUid={setEditingUid}
        editProfile={editProfile}
        setEditProfile={setEditProfile}
        search={search}
        setSearch={setSearch}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
      />
      <p className="text-xs text-[var(--text-muted)]">
        Access changes are audited. Encrypted exports should be stored in an approved private
        location.
      </p>
    </div>
  );
}
