"use client";
import { useState, type FormEvent } from "react";
export default function MfaForm({ onVerify }: { onVerify: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onVerify(code);
    } catch {
      setError("The verification code could not be accepted.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium">
        Authenticator code
        <input
          translate="no"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border px-3"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="min-h-11 w-full rounded-lg bg-[var(--primary)] px-4 font-semibold text-[var(--primary-contrast)]"
      >
        {busy ? "Verifying…" : "Verify"}
      </button>
    </form>
  );
}
