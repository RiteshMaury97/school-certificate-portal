"use client";
import { useEffect, useState, type SubmitEvent } from "react";

import CodeField from "./CodeField";

const primary =
  "flex min-h-12 w-full items-center justify-center rounded-lg bg-[var(--primary)] py-3 font-semibold text-[var(--on-primary)] disabled:opacity-70";
const secondary =
  "flex min-h-11 w-full items-center justify-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)]";

export function EmailCodeStep({
  busy,
  email,
  onVerify,
  onCancel,
  onResend,
  resendAfterSeconds = 60,
}: {
  busy: boolean;
  email: string;
  onVerify: (code: string) => void;
  onCancel: () => void;
  onResend: () => void;
  resendAfterSeconds?: number;
}) {
  const [code, setCode] = useState("");
  const [remaining, setRemaining] = useState(resendAfterSeconds);
  useEffect(() => {
    setRemaining(resendAfterSeconds);
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [resendAfterSeconds]);
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    onVerify(code);
  };
  const masked = email.replace(/^(.).+(@.+)$/, "$1***$2");
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        We sent a six-digit code to <strong className="text-[var(--text)]">{masked}</strong>. It is
        valid for 10 minutes. Never share this code.
      </p>
      <CodeField
        label="Email verification code"
        value={code}
        onChange={(value) => {
          setCode(value.replace(/\\D/g, "").slice(0, 6));
        }}
        autoFocus
      />
      <button disabled={busy || code.length !== 6} aria-busy={busy} className={primary}>
        {busy ? "Verifying…" : "Verify and sign in"}
      </button>
      <button
        type="button"
        disabled={busy || remaining > 0}
        onClick={() => {
          setCode("");
          onResend();
        }}
        className={secondary}
      >
        {remaining > 0 ? `Resend code in ${remaining}s` : "Resend code"}
      </button>
      <button type="button" onClick={onCancel} className={secondary}>
        Use a different account
      </button>
    </form>
  );
}

export function VerifyEmailStep({
  email,
  busy,
  onContinue,
  onCancel,
}: {
  email: string;
  busy: boolean;
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        Verify your email address ({email}) using the link sent by Firebase. Then return here.
      </p>
      <button type="button" disabled={busy} onClick={onContinue} className={primary}>
        I have verified my email
      </button>
      <button type="button" disabled={busy} onClick={onCancel} className={secondary}>
        Use a different account
      </button>
    </div>
  );
}

export function ChangeTemporaryPasswordStep({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean;
  onSubmit: (password: string) => void;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    if (password.length >= 12 && password === confirmation) onSubmit(password);
  };
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        This is your first sign-in. Set a new password to replace the temporary password before
        continuing.
      </p>
      <label htmlFor="new-admin-password" className="block text-sm font-medium">
        New password
        <input
          id="new-admin-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
        />
      </label>
      <label htmlFor="confirm-admin-password" className="block text-sm font-medium">
        Confirm new password
        <input
          id="confirm-admin-password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          value={confirmation}
          onChange={(event) => {
            setConfirmation(event.target.value);
          }}
          className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5"
        />
      </label>
      {confirmation && password !== confirmation && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          Passwords do not match.
        </p>
      )}
      <p className="text-xs text-[var(--text-muted)]">
        Use at least 12 characters. You will sign in again with your new password.
      </p>
      <button
        disabled={busy || password.length < 12 || password !== confirmation}
        aria-busy={busy}
        className={primary}
      >
        {busy ? "Updating password…" : "Set new password"}
      </button>
      <button type="button" disabled={busy} onClick={onCancel} className={secondary}>
        Cancel sign-in
      </button>
    </form>
  );
}
