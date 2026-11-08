"use client";

import { KeyRound, MailCheck } from "lucide-react";

import type { SyntheticEvent } from "react";

type Props = {
  busy: boolean;
  challengeActive: boolean;
  code: string;
  error: string;
  resendIn: number;
  onCancel: () => void;
  onCodeChange: (value: string) => void;
  onResend: () => void;
  onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
};

export default function GoogleSignInDialog({
  busy,
  challengeActive,
  code,
  error,
  resendIn,
  onCancel,
  onCodeChange,
  onResend,
  onSubmit,
}: Props) {
  if (!busy && !challengeActive && !error) return null;
  return (
    <div className="google-signin-backdrop">
      <section
        aria-labelledby="google-signin-title"
        aria-modal="true"
        className="google-signin-dialog"
        role="dialog"
      >
        <div className="google-signin-heading">
          <span className="google-signin-icon" aria-hidden="true">
            {challengeActive ? <MailCheck size={22} /> : <KeyRound size={22} />}
          </span>
          <div>
            <p className="google-signin-eyebrow">Administrator sign in</p>
            <h2 id="google-signin-title">
              {challengeActive ? "Verify your email" : "Google sign-in"}
            </h2>
          </div>
        </div>
        {challengeActive ? (
          <form onSubmit={onSubmit}>
            <p className="google-signin-description">
              Enter the six-digit code sent to your administrator email address to finish signing in.
            </p>
            <label>
              Verification code
              <input
                aria-label="Verification code"
                aria-required="true"
                autoComplete="one-time-code"
                id="google-signin-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => {
                  onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6));
                }}
                pattern="[0-9]{6}"
                required
                value={code}
                placeholder="000000"
              />
            </label>
            <div className="google-signin-actions">
              <button
                className="google-signin-primary"
                disabled={busy || code.length !== 6}
                type="submit"
              >
                {busy ? "Verifying…" : "Verify and sign in"}
              </button>
              <button
                className="google-signin-secondary"
                disabled={busy || resendIn > 0}
                onClick={onResend}
                type="button"
              >
                {resendIn > 0 ? `Resend in ${String(resendIn)}s` : "Resend code"}
              </button>
            </div>
          </form>
        ) : (
          <p>{busy ? "Connecting to Google..." : "Sign-in could not continue."}</p>
        )}
        {error ? (
          <p aria-live="polite" className="google-signin-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="google-signin-cancel" disabled={busy} onClick={onCancel} type="button">
          Cancel
        </button>
      </section>
    </div>
  );
}
