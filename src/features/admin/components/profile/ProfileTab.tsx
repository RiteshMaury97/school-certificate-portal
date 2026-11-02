"use client";

import { Camera, Check, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState, type ChangeEvent, type SubmitEvent, type ReactNode } from "react";

import { DatePicker } from "@/components/ui/DatePicker";
import type { Role } from "../../types/admin.types";

type Profile = {
  name: string;
  preferredName: string;
  staffId: string;
  gender: string;
  dateOfBirth: string;
  position: string;
  department: string;
  designation: string;
  campus: string;
  joiningDate: string;
  reportingManager: string;
  officeLocation: string;
  alternateEmail: string;
  primaryPhone: string;
  secondaryPhone: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  bio: string;
  preferredLanguage: string;
  timeZone: string;
  dateFormat: string;
  photoDataUrl: string;
  emailNotifications: boolean;
  systemNotifications: boolean;
};
type Account = {
  role?: Role;
  status?: string;
  lastLogin?: string | null;
  createdAt?: string | null;
  twoFactorEnabled?: boolean;
};
type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;

const emptyProfile: Profile = {
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
  bio: "",
  preferredLanguage: "en",
  timeZone: "Asia/Kolkata",
  dateFormat: "DD/MM/YYYY",
  photoDataUrl: "",
  emailNotifications: true,
  systemNotifications: true,
};

const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-muted)]";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium text-[var(--text)] ${className}`}>
      {label}
      {children}
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="mb-5 border-b border-[var(--divider)] pb-4">
        <h3 className="text-lg font-bold text-[var(--text)]">{title}</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function fileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read the profile photo.")); };
    reader.onerror = () => { reject(new Error("Could not read the profile photo.")); };
    reader.readAsDataURL(file);
  });
}

async function makeProfilePhoto(file: File) {
  if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024)
    throw new Error("Choose an image smaller than 8 MB.");
  const image = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo editing is unavailable in this browser.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const blob = await new Promise<Blob | null>((resolve) => { canvas.toBlob(resolve, "image/jpeg", 0.78); },
  );
  if (!blob) throw new Error("Could not prepare the profile photo.");
  const dataUrl = await fileAsDataUrl(blob);
  if (dataUrl.length > 300_000)
    throw new Error("This image is too detailed. Choose a smaller photo.");
  return dataUrl;
}

function formatAccountDate(value: string | null | undefined, profile: Profile) {
  if (!value) return "No record available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No record available";
  try {
    return new Intl.DateTimeFormat(profile.preferredLanguage || "en", {
      dateStyle: "medium",
      ...(value.includes("T") ? { timeStyle: "short" as const } : {}),
      timeZone: profile.timeZone || "Asia/Kolkata",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export default function ProfileTab({
  api,
  act,
  email,
  role,
  loadSessions,
}: {
  api: Api;
  act: (fn: () => Promise<void>) => Promise<void>;
  email: string;
  role: Role;
  loadSessions: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [savedProfile, setSavedProfile] = useState<Profile>(emptyProfile);
  const [account, setAccount] = useState<Account>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  useEffect(() => {
    let current = true;
    void api<{ profile: Partial<Profile>; account: Account }>("/api/admin/profile")
      .then((result) => {
        if (current) {
          const loadedProfile = { ...emptyProfile, ...result.profile };
          setProfile(loadedProfile);
          setSavedProfile(loadedProfile);
          setAccount(result.account ?? {});
        }
      })
      .catch((error: unknown) => {
        if (current)
          setLoadError(error instanceof Error ? error.message : "Unable to load your profile.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [api]);

  async function saveProfile(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await act(async () => {
        const result = await api<{ profile: Profile }>("/api/admin/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        });
        const saved = { ...emptyProfile, ...result.profile };
        setProfile(saved);
        setSavedProfile(saved);
      });
    } finally {
      setSaving(false);
    }
  }

  async function updatePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setPhotoError("");
    try {
      const photoDataUrl = await makeProfilePhoto(file);
      setProfile((value) => ({ ...value, photoDataUrl }));
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Could not update your photo.");
    }
  }

  async function requestPasswordReset() {
    setResetBusy(true);
    setResetMessage("");
    try {
      await api("/api/admin/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResetMessage(
        "If your account is eligible, password reset instructions have been sent to your official email.",
      );
    } catch (error) {
      setResetMessage(
        error instanceof Error ? error.message : "Password reset could not be requested.",
      );
    } finally {
      setResetBusy(false);
    }
  }

  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  const hasChanges = JSON.stringify(profile) !== JSON.stringify(savedProfile);
  const completionFields: (keyof Profile)[] = [
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
    "bio",
    "photoDataUrl",
  ];
  const completion = Math.round(
    (completionFields.filter((field) => String(profile[field]).trim().length > 0).length /
      completionFields.length) *
      100,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">
              Account / Profile settings
            </p>
            <h2 className="mt-1 text-2xl font-bold text-[var(--text)]">Your profile</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Manage your personal details, school information, contact methods, and preferences.
            </p>
          </div>
          <span className="rounded-full bg-[color-mix(in_srgb,var(--success)_12%,transparent)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--success)]">
            {account.status ?? "Active"} staff
          </span>
        </div>
      </header>

      {loadError && (
        <p
          role="alert"
          className="rounded-lg border border-[var(--danger)]/40 bg-[var(--surface)] p-4 text-sm text-[var(--danger)]"
        >
          {loadError}
        </p>
      )}
      {loading ? (
        <p
          role="status"
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-muted)]"
        >
          Loading your profile…
        </p>
      ) : !loadError ? (
        <>
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)]">
                <Check size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[var(--text)]">Complete your staff profile</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  A complete profile helps keep your school staff records accurate and up to date.
                </p>
              </div>
              <div className="min-w-24 text-right">
                <strong className="text-2xl text-[var(--success)]">{completion}%</strong>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  Profile complete
                </p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full bg-[var(--success)] transition-[width]"
                style={{ width: `${completion}%` }}
              />
            </div>
          </section>
          <form onSubmit={saveProfile} className="space-y-5">
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-5">
                <Section
                  title="Personal information"
                  description="Your identity and staff record details."
                >
                  <div className="mb-5 flex flex-wrap items-center gap-4">
                    <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-2xl font-bold text-[var(--primary)]">
                      {profile.photoDataUrl ? (
                        <img
                          src={profile.photoDataUrl}
                          alt="Your profile"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        profile.name.slice(0, 1).toUpperCase() || <UserRound size={28} />
                      )}
                    </div>
                    <div>
                      <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]">
                        <Camera size={16} aria-hidden="true" /> Upload profile photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => void updatePhoto(event)}
                          className="sr-only"
                        />
                      </label>
                      {profile.photoDataUrl && (
                        <button
                          type="button"
                          onClick={() => { update("photoDataUrl", ""); }}
                          className="ml-3 text-sm text-[var(--danger)] hover:underline"
                        >
                          Remove
                        </button>
                      )}
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        Images are resized and saved with your Firebase profile.
                      </p>
                      {photoError && (
                        <p role="alert" className="mt-1 text-xs text-[var(--danger)]">
                          {photoError}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Full name *">
                      <input
                        required
                        minLength={2}
                        maxLength={100}
                        value={profile.name}
                        onChange={(event) => { update("name", event.target.value); }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Preferred name">
                      <input
                        maxLength={80}
                        value={profile.preferredName}
                        onChange={(event) => { update("preferredName", event.target.value); }}
                        className={inputClass}
                        placeholder="Name colleagues use"
                      />
                    </Field>
                    <Field label="Employee / Staff ID">
                      <input
                        maxLength={50}
                        value={profile.staffId}
                        onChange={(event) => { update("staffId", event.target.value); }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Gender">
                      <select
                        value={profile.gender}
                        onChange={(event) => { update("gender", event.target.value); }}
                        className={inputClass}
                      >
                        <option value="">Prefer not to specify</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                        <option value="nonbinary">Non-binary</option>
                        <option value="prefer-not-to-say">Prefer not to say</option>
                        <option value="self-described">Self-described</option>
                      </select>
                    </Field>
                    <Field label="Date of birth">
                      <DatePicker
                        id="profile-date-of-birth"
                        label="Date of birth"
                        value={profile.dateOfBirth}
                        onChange={(value) => { update("dateOfBirth", value); }}
                      />
                    </Field>
                  </div>
                </Section>

                <Section
                  title="Professional information"
                  description="Your position and location within the school."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Job title / Position">
                      <input
                        maxLength={120}
                        value={profile.position}
                        onChange={(event) => { update("position", event.target.value); }}
                        className={inputClass}
                        placeholder="For example, Office Administrator"
                      />
                    </Field>
                    <Field label="Department">
                      <input
                        maxLength={120}
                        value={profile.department}
                        onChange={(event) => { update("department", event.target.value); }}
                        className={inputClass}
                        placeholder="For example, Student Records"
                      />
                    </Field>
                    <Field label="Staff designation">
                      <input
                        maxLength={120}
                        value={profile.designation}
                        onChange={(event) => { update("designation", event.target.value); }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Campus / Branch">
                      <input
                        maxLength={120}
                        value={profile.campus}
                        onChange={(event) => { update("campus", event.target.value); }}
                        className={inputClass}
                        placeholder="Lodipur, Zamania"
                      />
                    </Field>
                    <Field label="Joining date">
                      <DatePicker
                        id="profile-joining-date"
                        label="Joining date"
                        value={profile.joiningDate}
                        onChange={(value) => { update("joiningDate", value); }}
                      />
                    </Field>
                    <Field label="Reporting manager">
                      <input
                        maxLength={100}
                        value={profile.reportingManager}
                        onChange={(event) => { update("reportingManager", event.target.value); }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Office location" className="sm:col-span-2">
                      <input
                        maxLength={160}
                        value={profile.officeLocation}
                        onChange={(event) => { update("officeLocation", event.target.value); }}
                        className={inputClass}
                        placeholder="Building, floor, or room"
                      />
                    </Field>
                  </div>
                </Section>

                <Section
                  title="Contact information"
                  description="Official email is controlled by the school. Add alternate ways to reach you here."
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Official email">
                      <input
                        readOnly
                        value={email}
                        className={`${inputClass} cursor-not-allowed opacity-75`}
                      />
                      <span className="mt-1 block text-xs text-[var(--text-muted)]">
                        Managed by your school administrator
                      </span>
                    </Field>
                    <Field label="Personal / alternate email">
                      <input
                        type="email"
                        maxLength={254}
                        value={profile.alternateEmail}
                        onChange={(event) => { update("alternateEmail", event.target.value); }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Primary phone number">
                      <input
                        type="tel"
                        maxLength={30}
                        value={profile.primaryPhone}
                        onChange={(event) => { update("primaryPhone", event.target.value); }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Secondary phone number">
                      <input
                        type="tel"
                        maxLength={30}
                        value={profile.secondaryPhone}
                        onChange={(event) => { update("secondaryPhone", event.target.value); }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Address" className="sm:col-span-2">
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={profile.address}
                        onChange={(event) => { update("address", event.target.value); }}
                        className={`${inputClass} resize-y`}
                      />
                    </Field>
                  </div>
                </Section>
              </div>

              <aside className="space-y-5">
                <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)]">
                      <ShieldCheck size={20} />
                    </span>
                    <div>
                      <h3 className="font-bold text-[var(--text)]">Account &amp; security</h3>
                      <p className="text-xs capitalize text-[var(--text-muted)]">
                        {account.status ?? "Active"} account
                      </p>
                    </div>
                  </div>
                  <dl className="mt-5 space-y-3 text-sm">
                    <AccountRow label="Official email" value={email} />
                    <AccountRow
                      label="Account role"
                      value={(account.role ?? role).replace(/^./, (letter) => letter.toUpperCase())}
                    />
                    <AccountRow
                      label="Account status"
                      value={(account.status ?? "active").replace(/^./, (letter) =>
                        letter.toUpperCase(),
                      )}
                    />
                    <AccountRow
                      label="Last login"
                      value={formatAccountDate(account.lastLogin, profile)}
                    />
                    <AccountRow
                      label="Account created"
                      value={formatAccountDate(account.createdAt, profile)}
                    />
                    <AccountRow
                      label="Two-factor verification"
                      value={
                        account.twoFactorEnabled ? "Enabled · email code required" : "Not enabled"
                      }
                    />
                  </dl>
                  <div className="mt-5 border-t border-[var(--divider)] pt-4">
                    <button
                      type="button"
                      onClick={() => void requestPasswordReset()}
                      disabled={resetBusy}
                      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] disabled:opacity-50"
                    >
                      <KeyRound size={16} aria-hidden="true" />{" "}
                      {resetBusy ? "Sending reset email…" : "Send password reset email"}
                    </button>
                    {resetMessage && (
                      <p role="status" className="mt-2 text-xs text-[var(--text-muted)]">
                        {resetMessage}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void loadSessions()}
                      className="mt-2 min-h-10 w-full rounded-lg px-3 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--surface-2)]"
                    >
                      View active sessions &amp; login activity
                    </button>
                  </div>
                </section>
                <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h3 className="font-semibold text-[var(--text)]">Profile summary</h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {profile.preferredName || profile.name || email}
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    {profile.position || "Add your school position"}
                    {profile.department ? ` · ${profile.department}` : ""}
                  </p>
                  {profile.campus && (
                    <p className="mt-2 text-xs text-[var(--text-muted)]">{profile.campus}</p>
                  )}
                  <p className="mt-4 border-t border-[var(--divider)] pt-3 text-xs leading-5 text-[var(--text-muted)]">
                    Your profile details are saved to the Firebase administrator record. Account
                    access and official email are managed by the school.
                  </p>
                </section>
                <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h3 className="font-semibold text-[var(--text)]">Emergency contact</h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Optional, recommended for staff safety.
                  </p>
                  <div className="mt-3 space-y-3">
                    <Field label="Contact name">
                      <input
                        maxLength={100}
                        value={profile.emergencyContactName}
                        onChange={(event) => { update("emergencyContactName", event.target.value); }}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Contact phone">
                      <input
                        type="tel"
                        maxLength={30}
                        value={profile.emergencyContactPhone}
                        onChange={(event) => { update("emergencyContactPhone", event.target.value); }}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                </section>
              </aside>
            </div>
            <Section
              title="Preferences"
              description="Choose how the school platform communicates with you."
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Preferred language">
                  <select
                    value={profile.preferredLanguage}
                    onChange={(event) => { update("preferredLanguage", event.target.value); }}
                    className={inputClass}
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="bn">Bengali</option>
                    <option value="mr">Marathi</option>
                    <option value="gu">Gujarati</option>
                    <option value="pa">Punjabi</option>
                    <option value="ta">Tamil</option>
                    <option value="te">Telugu</option>
                    <option value="ur">Urdu</option>
                  </select>
                </Field>
                <Field label="Time zone">
                  <select
                    value={profile.timeZone}
                    onChange={(event) => { update("timeZone", event.target.value); }}
                    className={inputClass}
                  >
                    <option value="Asia/Kolkata">India Standard Time (Asia/Kolkata)</option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Dubai">Gulf Standard Time (Asia/Dubai)</option>
                    <option value="Europe/London">United Kingdom (Europe/London)</option>
                    <option value="America/New_York">Eastern Time (America/New_York)</option>
                  </select>
                </Field>
                <Field label="Date format">
                  <select
                    value={profile.dateFormat}
                    onChange={(event) => { update("dateFormat", event.target.value); }}
                    className={inputClass}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </Field>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Toggle
                  label="Email notifications"
                  description="Receive account and school updates by email."
                  checked={profile.emailNotifications}
                  onChange={(checked) => { update("emailNotifications", checked); }}
                />
                <Toggle
                  label="System notifications"
                  description="Show notices in the admin panel."
                  checked={profile.systemNotifications}
                  onChange={(checked) => { update("systemNotifications", checked); }}
                />
              </div>
            </Section>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving || !hasChanges}
                className="min-h-11 rounded-lg bg-[var(--primary)] px-6 font-semibold text-[var(--on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save profile changes"}
              </button>
              <button
                type="button"
                disabled={!hasChanges || saving}
                onClick={() => { setProfile(savedProfile); }}
                className="min-h-11 rounded-lg px-4 text-sm font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Discard changes
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                Changes are securely stored with your Firebase profile.
              </span>
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}

function AccountRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-[var(--text)]">{value}</dd>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--divider)] bg-[var(--bg)] p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => { onChange(event.target.checked); }}
        className="mt-1 h-4 w-4 accent-[var(--primary)]"
      />
      <span>
        <span className="block text-sm font-semibold text-[var(--text)]">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{description}</span>
      </span>
    </label>
  );
}
