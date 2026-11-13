"use client";
import { useState } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";

function csrfToken() {
  return decodeURIComponent(
    document.cookie
      .split("; ")
      .find((item) => item.startsWith("sis_admin_csrf="))
      ?.split("=")[1] ?? "",
  );
}
async function post(path: string, body: Record<string, string>, csrf = false) {
  const headers = new Headers({ "Content-Type": "application/json", ...(await appCheckHeaders()) });
  if (csrf) headers.set("x-csrf-token", csrfToken());
  const response = await fetch(path, {
    method: "POST",
    headers,
    credentials: "same-origin",
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data: unknown = await response.json().catch(() => null);
  return { response, data };
}
function errorMessage(data: unknown, fallback: string) {
  return typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "string"
    ? data.error
    : fallback;
}

// eslint-disable-next-line max-lines-per-function -- reason: keep the security-sensitive email-code flow and its UI transitions together.
export default function ReauthModal({
  email,
  onComplete,
  onCancel,
}: {
  email: string;
  onComplete: (grant: string) => void;
  onCancel: () => void;
}) {
  const [stage, setStage] = useState<"send" | "code">("send");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    setBusy(true);
    setError("");
    try {
      const sent = await post("/api/admin/otp/send", { session: "true" }, true);
      if (
        !sent.response.ok ||
        typeof sent.data !== "object" ||
        sent.data === null ||
        !("challengeId" in sent.data) ||
        typeof sent.data.challengeId !== "string"
      )
        throw new Error(errorMessage(sent.data, "Could not send the verification code."));
      setChallengeId(sent.data.challengeId);
      setStage("code");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send the verification code.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError("");
    try {
      if (!/^\d{6}$/.test(code)) throw new Error("Enter the six-digit email code.");
      const checked = await post(
        "/api/admin/otp/verify",
        { session: "true", challengeId, code },
        true,
      );
      if (!checked.response.ok)
        throw new Error(errorMessage(checked.data, "The code is invalid or expired."));
      const result = await post("/api/admin/reauth", { challengeId }, true);
      if (
        !result.response.ok ||
        typeof result.data !== "object" ||
        result.data === null ||
        !("grant" in result.data) ||
        typeof result.data.grant !== "string"
      )
        throw new Error(errorMessage(result.data, "Email-code verification is required."));
      onComplete(result.data.grant);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="presentation" className="fixed inset-0 z-[100] grid place-items-center bg-[var(--text)]/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="reauth-title"
        className="w-full max-w-md space-y-4 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-6 text-[var(--text)] shadow-xl"
      >
        <h2 id="reauth-title" className="text-lg font-semibold">Confirm it’s you</h2>
        {stage === "send" ? (
          <>
            <p className="text-sm text-[var(--text-muted)]">
              We’ll send a one-time code to your administrator email ({email}).
            </p>
            <button
              aria-label="Send re-authentication code"
              disabled={busy}
              onClick={() => void sendCode()}
              className="min-h-11 w-full rounded bg-[var(--primary)] px-4 font-semibold text-[var(--on-primary)]"
            >
              {busy ? "Sending…" : "Send email code"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-[var(--text-muted)]">
              Enter the six-digit code sent to your administrator email.
            </p>
            <label htmlFor="reauth-code" className="block text-sm">
              Email code *
              <input
                id="reauth-code"
                aria-label="Six-digit email code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                aria-required="true"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="mt-1 min-h-12 w-full rounded border border-[var(--divider)] bg-[var(--surface)] px-3 text-center text-xl tracking-[0.35em]"
              />
            </label>
            <button
              aria-label="Verify email code"
              disabled={busy || code.length !== 6}
              onClick={() => void verify()}
              className="min-h-11 w-full rounded bg-[var(--primary)] px-4 font-semibold text-[var(--on-primary)]"
            >
              {busy ? "Verifying…" : "Verify"}
            </button>
          </>
        )}
        {error && <p role="alert" className="rounded bg-[var(--surface-2)] p-3 text-sm">{error}</p>}
        <button
          disabled={busy}
          onClick={onCancel}
          className="min-h-11 w-full rounded border border-[var(--divider)] px-4 text-sm"
        >
          Cancel
        </button>
      </section>
    </div>
  );
}
