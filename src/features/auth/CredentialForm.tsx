import { Eye, EyeOff } from "lucide-react";

import type { SyntheticEvent } from "react";

type Props = {
  busy: boolean;
  email: string;
  password: string;
  showPassword: boolean;
  emailInvalid: boolean;
  passwordInvalid: boolean;
  onEmailChange: (email: string) => void;
  onEmailValidityChange: (valid: boolean) => void;
  onPasswordChange: (password: string) => void;
  onPasswordValidityChange: (valid: boolean) => void;
  onTogglePassword: () => void;
  onForgotPassword: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
  onGoogle: () => void;
};

const field =
  "admin-auth-input mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] aria-[invalid=true]:border-[var(--danger)]";
const primary =
  "flex min-h-11 w-full items-center justify-center rounded-lg bg-[var(--primary)] py-2.5 font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export default function CredentialForm({
  busy,
  email,
  password,
  showPassword,
  emailInvalid,
  passwordInvalid,
  onEmailChange,
  onEmailValidityChange,
  onPasswordChange,
  onPasswordValidityChange,
  onTogglePassword,
  onForgotPassword,
  onSubmit,
  onGoogle,
}: Props) {
  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        <label htmlFor="admin-email" className="block text-sm font-medium">
          Email Address
          <input
            id="admin-email"
            aria-label="Email address"
            aria-invalid={emailInvalid}
            translate="no"
            type="email"
            autoComplete="email"
            required aria-required="true"
            placeholder="Enter your registered email address"
            value={email}
            onInvalid={() => {
              onEmailValidityChange(false);
            }}
            onBlur={(event) => {
              onEmailValidityChange(event.currentTarget.validity.valid);
            }}
            onChange={(event) => {
              onEmailChange(event.target.value);
              onEmailValidityChange(event.currentTarget.validity.valid);
            }}
            className={field}
          />
        </label>
        <div className="relative">
          <label htmlFor="admin-password" className="block text-sm font-medium">
            Password
            <input
              id="admin-password"
              aria-label="Password"
              aria-invalid={passwordInvalid}
              translate="no"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required aria-required="true"
              value={password}
              onInvalid={() => {
                onPasswordValidityChange(false);
              }}
              onBlur={(event) => {
                onPasswordValidityChange(event.currentTarget.validity.valid);
              }}
              onChange={(event) => {
                onPasswordChange(event.target.value);
                onPasswordValidityChange(event.currentTarget.validity.valid);
              }}
              className={`${field} pr-12`}
            />
          </label>
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            title={showPassword ? "Hide password" : "Show password"}
            onClick={onTogglePassword}
            className="absolute bottom-0 right-1 grid min-h-10 min-w-10 place-items-center rounded-lg text-[var(--text-muted)] outline-none hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" size={18} />
            ) : (
              <Eye aria-hidden="true" size={18} />
            )}
          </button>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onForgotPassword}
            className="inline-flex min-h-8 items-center text-xs font-medium text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          >
            Forgot password?
          </button>
        </div>
        <button type="submit" disabled={busy} aria-busy={busy} className={primary}>
          {busy ? "Verifying…" : "Sign In"}
        </button>
      </form>
      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--divider)]" />
        <span className="text-xs text-[var(--text-muted)]">or</span>
        <span className="h-px flex-1 bg-[var(--divider)]" />
      </div>
      <button
        type="button"
        onClick={onGoogle}
        disabled={busy}
        aria-busy={busy}
        className="flex min-h-11 w-full items-center justify-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 font-semibold text-[var(--text)] outline-none transition hover:bg-[var(--surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? "Connecting…" : "Continue with Google"}
      </button>
    </>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5">
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
