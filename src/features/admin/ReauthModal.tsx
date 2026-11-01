"use client";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, signOut } from "firebase/auth";
import { useState } from "react";

import { auth, appCheckHeaders } from "@/lib/firebase-client";

function csrfToken() {
  return decodeURIComponent(document.cookie.split("; ").find((item) => item.startsWith("sis_admin_csrf="))?.split("=")[1] ?? "");
}
async function post(path: string, body: Record<string, string>, csrf = false) {
  const headers = new Headers({ "Content-Type": "application/json", ...(await appCheckHeaders()) });
  if (csrf) headers.set("x-csrf-token", csrfToken());
  const response = await fetch(path, { method: "POST", headers, credentials: "same-origin", body: JSON.stringify(body), cache: "no-store" });
  const data: unknown = await response.json().catch(() => null);
  return { response, data };
}
function errorMessage(data: unknown, fallback: string) {
  return typeof data === "object" && data !== null && "error" in data && typeof data.error === "string" ? data.error : fallback;
}
export default function ReauthModal({ email, onComplete, onCancel }: { email: string; onComplete: (grant: string) => void; onCancel: () => void }) {
  const [stage, setStage] = useState<"credential" | "code">("credential");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<"password" | "google">("password");
  const finishCredential = async () => {
    setBusy(true); setError("");
    try {
      if (method === "password") await signInWithEmailAndPassword(auth, email, password);
      else await signInWithPopup(auth, new GoogleAuthProvider());
      const user = auth.currentUser;
      if (!user) throw new Error("Re-authentication failed.");
      const idToken = await user.getIdToken(true);
      const sent = await post("/api/admin/otp/send", { idToken });
      if (!sent.response.ok || typeof sent.data !== "object" || sent.data === null || !("challengeId" in sent.data) || typeof sent.data.challengeId !== "string") throw new Error(errorMessage(sent.data, "Could not send the verification code."));
      setChallengeId(sent.data.challengeId); setStage("code");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Re-authentication failed."); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError("");
    try {
      if (!/^\\d{6}$/.test(code)) throw new Error("Enter the six-digit email code.");
      const user = auth.currentUser;
      if (!user) throw new Error("Re-authentication expired. Start again.");
      const idToken = await user.getIdToken(true);
      const checked = await post("/api/admin/otp/verify", { idToken, challengeId, code });
      if (!checked.response.ok) throw new Error(errorMessage(checked.data, "The code is invalid or expired."));
      const result = await post("/api/admin/reauth", { idToken, challengeId }, true);
      if (!result.response.ok || typeof result.data !== "object" || result.data === null || !("grant" in result.data) || typeof result.data.grant !== "string") throw new Error(errorMessage(result.data, "Recent credential and email-code verification are required."));
      onComplete(result.data.grant);
      await signOut(auth).catch(() => {});
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Verification failed."); }
    finally { setBusy(false); }
  };
  return <div role="presentation" className="fixed inset-0 z-[100] grid place-items-center bg-[var(--text)]/50 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="reauth-title" className="w-full max-w-md space-y-4 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-6 text-[var(--text)] shadow-xl">
      <h2 id="reauth-title" className="text-lg font-semibold">Confirm it’s you</h2>
      {stage === "credential" ? <>
        <p className="text-sm text-[var(--text-muted)]">Confirm your administrator account before receiving a one-time email code.</p>
        <label className="block text-sm">Verification method
          <select value={method} onChange={(event) => { setMethod(event.target.value as typeof method); }} className="mt-1 min-h-11 w-full rounded border border-[var(--divider)] bg-[var(--surface)] px-3">
            <option value="password">Email and password</option><option value="google">Google</option>
          </select>
        </label>
        {method === "password" && <label className="block text-sm">Password
          <input autoFocus type="password" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); }} className="mt-1 min-h-11 w-full rounded border border-[var(--divider)] bg-[var(--surface)] px-3" />
        </label>}
        <button disabled={busy || (method === "password" && !password)} onClick={() => void finishCredential()} className="min-h-11 w-full rounded bg-[var(--primary)] px-4 font-semibold text-[var(--on-primary)]">{busy ? "Checking…" : "Continue"}</button>
      </> : <>
        <p className="text-sm text-[var(--text-muted)]">Enter the six-digit code sent to your administrator email.</p>
        <label className="block text-sm">Email code
          <input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => { setCode(event.target.value.replace(/\\D/g, "").slice(0, 6)); }} className="mt-1 min-h-12 w-full rounded border border-[var(--divider)] bg-[var(--surface)] px-3 text-center text-xl tracking-[0.35em]" />
        </label>
        <button disabled={busy || code.length !== 6} onClick={() => void verify()} className="min-h-11 w-full rounded bg-[var(--primary)] px-4 font-semibold text-[var(--on-primary)]">{busy ? "Verifying…" : "Verify"}</button>
      </>}
      {error && <p role="alert" className="rounded bg-[var(--surface-2)] p-3 text-sm">{error}</p>}
      <button disabled={busy} onClick={() => { void signOut(auth).finally(onCancel); }} className="min-h-11 w-full rounded border border-[var(--divider)] px-4 text-sm">Cancel</button>
    </section>
  </div>;
}
