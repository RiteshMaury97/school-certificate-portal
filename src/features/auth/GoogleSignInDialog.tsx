"use client";

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
        <h2 id="google-signin-title">{challengeActive ? "Verify your email" : "Google sign-in"}</h2>
        {challengeActive ? (
          <form onSubmit={onSubmit}>
            <p>Enter the six-digit code sent to your administrator email address.</p>
            <label>
              Verification code
              <input
                aria-label="Verification code"
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
              />
            </label>
            <div className="google-signin-actions">
              <button disabled={busy || code.length !== 6} type="submit">
                {busy ? "Verifying..." : "Verify and sign in"}
              </button>
              <button disabled={busy || resendIn > 0} onClick={onResend} type="button">
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
