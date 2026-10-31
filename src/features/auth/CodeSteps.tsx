"use client";
import { useState, type FormEvent } from "react";
import CodeField from "./CodeField";

const primary =
  "flex min-h-12 w-full items-center justify-center rounded-lg bg-[var(--primary)] py-3 font-semibold text-[var(--on-primary)] disabled:opacity-70";
const secondary =
  "flex min-h-11 w-full items-center justify-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)]";

export function MfaStep({
  busy,
  onVerify,
  onCancel,
}: {
  busy: boolean;
  onVerify: (code: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onVerify(code);
  };
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <p className="text-sm text-[var(--text-muted)]">
        Enter the six-digit code from your authenticator app.
      </p>
      <CodeField label="Authenticator code" value={code} onChange={setCode} autoFocus />
      <button disabled={busy || code.length !== 6} aria-busy={busy} className={primary}>
        {busy ? "Verifying…" : "Verify and sign in"}
      </button>
      <button type="button" onClick={onCancel} className={secondary}>
        Use a different account
      </button>
    </form>
  );
}

export function VerifyEmailStep({
  busy,
  email,
  onContinue,
  onResend,
  onCancel,
}: {
  busy: boolean;
  email: string;
  onContinue: () => void;
  onResend: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-[var(--text)]">
        Your email address ({email}) must be verified before you can set up the authenticator. Open the
        link we just emailed you, then continue.
      </p>
      <button type="button" onClick={onContinue} disabled={busy} aria-busy={busy} className={primary}>
        I’ve verified my email
      </button>
      <button type="button" onClick={onResend} disabled={busy} aria-busy={busy} className={secondary}>
        Send the email again
      </button>
      <button type="button" onClick={onCancel} className={secondary}>
        Cancel
      </button>
    </div>
  );
}

export function EnrollStep({
  busy,
  secretKey,
  otpauthUri,
  onEnroll,
  onCancel,
}: {
  busy: boolean;
  secretKey: string;
  otpauthUri: string;
  onEnroll: (code: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onEnroll(code);
  };
  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <p className="text-sm text-[var(--text)]">
        On your phone, open Google Authenticator, Microsoft Authenticator or a similar app and add this
        account.
      </p>
      {otpauthUri && (
        <a
          href={otpauthUri}
          className="flex min-h-11 w-full items-center justify-center rounded-lg border border-[var(--border)] px-4 text-sm font-semibold text-[var(--text)]"
        >
          Open in authenticator app (phone)
        </a>
      )}
      <p className="text-xs text-[var(--text-muted)]">Or enter this setup key manually:</p>
      <code className="block select-all break-all rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--text)]">
        {secretKey}
      </code>
      <CodeField label="Six-digit setup code" value={code} onChange={setCode} />
      <button disabled={busy || code.length !== 6} aria-busy={busy} className={primary}>
        {busy ? "Checking…" : "Enroll authenticator"}
      </button>
      <button type="button" onClick={onCancel} className={secondary}>
        Cancel
      </button>
    </form>
  );
}
