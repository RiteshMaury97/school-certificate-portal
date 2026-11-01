"use client";
import { Eye, EyeOff } from "lucide-react";
import { useState, type SyntheticEvent } from "react";

type Props = {
  busy: boolean;
  resetBusy: boolean;
  onSubmit: (email: string, password: string) => void;
  onGoogle: () => void;
  onReset: (email: string) => void;
};

const field =
  "mt-2 min-h-11 w-full rounded-lg border border-[#d5dfd8] bg-white p-3 text-[#17251f] placeholder:text-[#9aa69e] focus:border-[#315d4c] focus:outline-none focus:ring-2 focus:ring-[#315d4c]/15";
const primary =
  "flex min-h-12 w-full items-center justify-center rounded-lg bg-[#315d4c] py-3 font-semibold text-white transition hover:bg-[#244b3b] disabled:opacity-70";

export default function CredentialsStep({ busy, resetBusy, onSubmit, onGoogle, onReset }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(email.trim(), password);
  };
  return (
    <>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label htmlFor="admin-email" className="block text-sm font-medium">
          Email
          <input
            id="admin-email"
            aria-label="Email address"
            translate="no"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            className={field}
          />
        </label>
        <div>
          <label htmlFor="admin-password" className="block text-sm font-medium">
            Password
            <div className="mt-2 flex gap-2">
              <input
                id="admin-password"
                aria-label="Password"
                translate="no"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                }}
                className={`${field} mt-0`}
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                title={show ? "Hide password" : "Show password"}
                onClick={() => {
                  setShow((value) => !value);
                }}
                className="min-h-11 shrink-0 rounded-lg border border-[var(--border)] px-3 text-[var(--text)]"
              >
                {show ? (
                  <EyeOff aria-hidden="true" size={18} />
                ) : (
                  <Eye aria-hidden="true" size={18} />
                )}
              </button>
            </div>
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              onReset(email);
            }}
            disabled={resetBusy}
            aria-busy={resetBusy}
            className="inline-flex items-center text-xs font-medium text-[#315d4c] hover:underline"
          >
            {resetBusy ? "Sending…" : "Forgot password?"}
          </button>
        </div>
        <button disabled={busy} aria-busy={busy} className={primary}>
          {busy ? "Verifying…" : "Continue securely"}
        </button>
      </form>
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--divider)]" />
        <span className="text-xs text-[var(--text-muted)]">or</span>
        <span className="h-px flex-1 bg-[var(--divider)]" />
      </div>
      <button
        type="button"
        onClick={onGoogle}
        disabled={busy}
        aria-busy={busy}
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 font-semibold text-[var(--text)] disabled:opacity-60"
      >
        <GoogleMark />
        Continue with Google
      </button>
    </>
  );
}

/** Google requires its brand colours on this mark. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 3.04 13.22l7.98 6.19C12.91 13.72 18.03 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.25 5.48-4.73 7.18l7.64 5.92c4.46-4.12 7.13-10.2 7.13-17.57Z"
      />
      <path
        fill="#FBBC05"
        d="M10.02 28.59A14.4 14.4 0 0 1 9.25 24c0-1.59.27-3.13.77-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.88.93 7.55 2.58 10.78l7.44-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.47 0 11.91-2.13 15.85-5.78l-7.64-5.92c-2.12 1.42-4.83 2.27-8.21 2.27-5.97 0-11.09-4.22-12.98-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}
