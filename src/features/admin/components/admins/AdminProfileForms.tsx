import { Clock3, Download, ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { PERSON_NAME_PATTERN, PHONE_NUMBER_PATTERN } from "@/shared/html-patterns";

import type { AdminInviteProfile, AdminInviteRole } from "../../types/admin-state.types";
import type { Dispatch, SetStateAction, SubmitEventHandler } from "react";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;

export type AdminProfileActions = {
  act: (fn: () => Promise<void>) => Promise<void>;
  api: Api;
  load: () => Promise<void>;
};

export const blankProfile: AdminInviteProfile = {
  name: "",
  preferredName: "",
  staffId: "",
  gender: "",
  dateOfBirth: "",
  position: "",
  department: "",
  designation: "",
  campus: "",
  joiningDate: "",
  reportingManager: "",
  officeLocation: "",
  alternateEmail: "",
  primaryPhone: "",
  secondaryPhone: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
};

export function AdminSummary({ admins }: { admins: Record<string, unknown>[] }) {
  const cards = [
    { label: "Total staff", count: admins.length, note: "Across all campuses", Icon: Users },
    {
      label: "Active accounts",
      count: admins.filter((item) => item.status === "active").length,
      note: "Can access workspace",
      Icon: UserCheck,
    },
    {
      label: "Pending activation",
      count: admins.filter((item) => item.status === "invited").length,
      note: "Invitation sent",
      Icon: Clock3,
    },
    {
      label: "Disabled accounts",
      count: admins.filter((item) => item.status === "disabled").length,
      note: "Access currently blocked",
      Icon: UserX,
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, count, note, Icon }) => (
        <article key={label} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-primary">
              <Icon size={17} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                {label}
              </p>
              <strong className="text-xl text-text">{count}</strong>
            </div>
          </div>
          <p className="mt-2 text-xs text-text-muted">{note}</p>
        </article>
      ))}
    </div>
  );
}

export function AdminTools({
  exportData,
  createBackup,
}: {
  exportData: (format: "json" | "csv") => Promise<void>;
  createBackup: () => Promise<void>;
}) {
  return (
    <section className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <span className="mr-auto text-sm font-semibold text-[var(--text)]">
        Secure administration tools
      </span>
      <button
        type="button"
        onClick={() => {
          void exportData("json");
        }}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text)]"
      >
        <Download size={14} /> Export encrypted JSON
      </button>
      <button
        type="button"
        onClick={() => {
          void exportData("csv");
        }}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-xs font-semibold text-[var(--text)]"
      >
        <Download size={14} /> Export encrypted CSV
      </button>
      <button
        type="button"
        onClick={() => {
          void createBackup();
        }}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3 text-xs font-semibold text-[var(--primary)]"
      >
        <ShieldCheck size={14} /> Create private R2 backup
      </button>
    </section>
  );
}

export function isAdminInviteRole(value: string): value is AdminInviteRole {
  return ["uploader", "approver", "admin", "superadmin"].includes(value);
}

export function profileForEdit(value: unknown): AdminInviteProfile {
  const saved = isRecord(value) ? value : {};
  return profileKeys.reduce(
    (profile, key) => {
      profile[key] = stringValue(saved[key]);
      return profile;
    },
    { ...blankProfile },
  );
}

const profileKeys = [
  "name",
  "preferredName",
  "staffId",
  "gender",
  "dateOfBirth",
  "position",
  "department",
  "designation",
  "campus",
  "joiningDate",
  "reportingManager",
  "officeLocation",
  "alternateEmail",
  "primaryPhone",
  "secondaryPhone",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
] satisfies (keyof AdminInviteProfile)[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function StaffProfileFields({
  profile,
  setProfile,
  idPrefix,
}: {
  profile: AdminInviteProfile;
  setProfile: Dispatch<SetStateAction<AdminInviteProfile>>;
  idPrefix: string;
}) {
  const fields = [
    ["preferredName", "Preferred name", "text"],
    ["staffId", "Employee / Staff ID", "text"],
    ["dateOfBirth", "Date of birth", "date"],
    ["position", "Job title / Position", "text"],
    ["department", "Department", "text"],
    ["designation", "Staff designation", "text"],
    ["campus", "Campus / Branch", "text"],
    ["joiningDate", "Joining date", "date"],
    ["reportingManager", "Reporting manager", "text"],
    ["officeLocation", "Office location", "text"],
    ["alternateEmail", "Personal / alternate email", "email"],
    ["primaryPhone", "Primary phone", "tel"],
    ["secondaryPhone", "Secondary phone", "tel"],
    ["emergencyContactName", "Emergency contact name", "text"],
    ["emergencyContactPhone", "Emergency contact phone", "tel"],
  ] as const satisfies readonly [keyof AdminInviteProfile, string, string][];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label htmlFor={`${idPrefix}-name`} className="text-sm">
        Full name *
        <input
          id={`${idPrefix}-name`}
          aria-label="Full name"
          required
          aria-required="true"
          minLength={2}
          maxLength={80}
          pattern={PERSON_NAME_PATTERN}
          value={profile.name}
          onChange={(event) => {
            setProfile((current) => ({ ...current, name: event.target.value }));
          }}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>
      {fields.map(([key, label, type]) => {
        const id = `${idPrefix}-${key}`;
        return (
          <label key={key} htmlFor={id} className="text-sm">
            {label}
            <input
              id={id}
              aria-label={label}
              translate="no"
              type={type}
              inputMode={type === "email" ? "email" : type === "tel" ? "tel" : undefined}
              autoComplete={
                key === "alternateEmail"
                  ? "email"
                  : type === "tel"
                    ? "tel"
                    : key === "dateOfBirth"
                      ? "bday"
                      : undefined
              }
              pattern={type === "tel" ? PHONE_NUMBER_PATTERN : undefined}
              maxLength={
                key === "alternateEmail"
                  ? 254
                  : ["primaryPhone", "secondaryPhone", "emergencyContactPhone"].includes(key)
                    ? 16
                    : key === "officeLocation"
                      ? 160
                      : key === "preferredName" || key === "emergencyContactName"
                        ? 80
                        : 120
              }
              value={profile[key]}
              onChange={(event) => {
                setProfile((current) => ({ ...current, [key]: event.target.value }));
              }}
              className="mt-1 w-full rounded border px-3 py-2"
              required
              aria-required="true"
            />
          </label>
        );
      })}
      <label htmlFor={`${idPrefix}-gender`} className="text-sm">
        Gender
        <select
          id={`${idPrefix}-gender`}
          value={profile.gender}
          onChange={(event) => {
            setProfile((current) => ({ ...current, gender: event.target.value }));
          }}
          className="mt-1 w-full rounded border px-3 py-2"
          required
          aria-required="true"
        >
          <option value="">Prefer not to specify</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="nonbinary">Non-binary</option>
          <option value="prefer-not-to-say">Prefer not to say</option>
          <option value="self-described">Self-described</option>
        </select>
      </label>
      <label htmlFor={`${idPrefix}-address`} className="text-sm sm:col-span-2 lg:col-span-3">
        Address
        <textarea
          id={`${idPrefix}-address`}
          aria-label="Address"
          maxLength={500}
          rows={2}
          value={profile.address}
          onChange={(event) => {
            setProfile((current) => ({ ...current, address: event.target.value }));
          }}
          className="mt-1 w-full rounded border px-3 py-2"
          required
          aria-required="true"
        />
      </label>
    </div>
  );
}

export function InviteForm(props: {
  adminEmail: string;
  setAdminEmail: Dispatch<SetStateAction<string>>;
  inviteRole: AdminInviteRole;
  setInviteRole: Dispatch<SetStateAction<AdminInviteRole>>;
  inviteProfile: AdminInviteProfile;
  setInviteProfile: Dispatch<SetStateAction<AdminInviteProfile>>;
  invite: SubmitEventHandler<HTMLFormElement>;
}) {
  return (
    <form
      onSubmit={props.invite}
      className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--divider)] pb-4">
        <div>
          <h3 className="font-bold text-[var(--text)]">Create a new staff account</h3>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            The invitation includes a temporary password and verification link. Staff must set a new
            password before access is granted.
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[10px] font-semibold uppercase text-[var(--success)]">
          Secure invitation
        </span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label
          htmlFor="admin-invite-email"
          className="text-xs font-medium text-[var(--text-muted)]"
        >
          Official email
          <input
            id="admin-invite-email"
            aria-label="Official email"
            translate="no"
            type="email"
            required
            aria-required="true"
            value={props.adminEmail}
            onChange={(event) => {
              props.setAdminEmail(event.target.value);
            }}
            placeholder="Enter official school email"
            className="mt-1 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
          />
        </label>
        <label htmlFor="admin-invite-role" className="text-xs font-medium text-[var(--text-muted)]">
          Role
          <select
            id="admin-invite-role"
            translate="no"
            required
            aria-required="true"
            value={props.inviteRole}
            onChange={(event) => {
              if (isAdminInviteRole(event.target.value)) props.setInviteRole(event.target.value);
            }}
            className="mt-1 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)]"
          >
            <option value="uploader">Uploader</option>
            <option value="approver">Approver</option>
            <option value="admin">Admin (uploader + approver)</option>
            <option value="superadmin">Superadmin</option>
          </select>
        </label>
      </div>
      <div className="mt-3">
        <StaffProfileFields
          profile={props.inviteProfile}
          setProfile={props.setInviteProfile}
          idPrefix="admin-invite-profile"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]">
          Create user &amp; send invitation
        </button>
        <span className="text-xs text-[var(--text-muted)]">Required fields are marked *</span>
      </div>
    </form>
  );
}

export function EditProfileForm({
  uid,
  profile,
  setProfile,
  act,
  api,
  load,
  onClose,
}: {
  uid: string;
  profile: AdminInviteProfile;
  setProfile: Dispatch<SetStateAction<AdminInviteProfile>>;
  onClose: () => void;
} & AdminProfileActions) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void act(async () => {
          await api("/api/admin/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uid, profile }),
          });
          await load();
          onClose();
        });
      }}
      className="border-t border-[var(--divider)] bg-[var(--surface-2)] p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-semibold text-[var(--text)]">Edit staff profile</h4>
        <button type="button" onClick={onClose} className="text-xs">
          Cancel
        </button>
      </div>
      <StaffProfileFields
        profile={profile}
        setProfile={setProfile}
        idPrefix={`admin-edit-${uid}`}
      />
      <button className="mt-4 min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]">
        Save profile details
      </button>
    </form>
  );
}
