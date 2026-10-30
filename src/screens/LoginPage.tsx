"use client";
import {
  getMultiFactorResolver,
  multiFactor,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  TotpMultiFactorGenerator,
} from "firebase/auth";
import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { appCheckHeaders, auth } from "@/src/lib/firebase-client";
import { usePublicSiteSettings } from "@/src/lib/use-site-settings";

import type { MultiFactorError, User } from "firebase/auth";
import type { FormEvent} from "react";
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolver, setResolver] = useState<ReturnType<typeof getMultiFactorResolver> | null>(null);
  const [factorUid, setFactorUid] = useState("");
  const [enrollUser, setEnrollUser] = useState<User | null>(null);
  const [secret, setSecret] = useState<Awaited<
    ReturnType<typeof TotpMultiFactorGenerator.generateSecret>
  > | null>(null);
  const navigate = useNavigate();
  const settings = usePublicSiteSettings();
  async function beginSecondFactor(user: User) {
    const gate = await fetch("/api/admin/login-check", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await appCheckHeaders()) },
      body: JSON.stringify({ email: user.email ?? "", action: "check" }),
      cache: "no-store",
    });
    if (gate.status === 423) {
      await signOut(auth);
      throw new Error("This account is temporarily locked after repeated failed sign-ins.");
    }
    const preflight = await fetch("/api/admin/preflight", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await user.getIdToken(true)}`,
        ...(await appCheckHeaders()),
      },
      cache: "no-store",
    });
    if (!preflight.ok) {
      await signOut(auth);
      throw new Error("This account is not authorized.");
    }
    const factors = multiFactor(user).enrolledFactors;
    const totp = factors.find((factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID);
    if (totp) {
      throw new Error(
        "Your account requires an authenticator challenge. Sign in again to complete MFA.",
      );
    }
    const session = await multiFactor(user).getSession();
    const generated = await TotpMultiFactorGenerator.generateSecret(session);
    setEnrollUser(user);
    setSecret(generated);
    setCode("");
    setNotice(
      "Set up your required authenticator. After enrollment, sign in again to complete MFA.",
    );
  }
  async function handleGoogle() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      const credential = await signInWithPopup(auth, provider);
      await beginSecondFactor(credential.user);
    } catch (cause) {
      const code = (cause as { code?: string }).code ?? "";
      if (code === "auth/multi-factor-auth-required") {
        try {
          const multi = getMultiFactorResolver(auth, cause as MultiFactorError);
          const factor = multi.hints.find(
            (item) => item.factorId === TotpMultiFactorGenerator.FACTOR_ID,
          );
          if (!factor) throw new Error("This account is not authorized.");
          setResolver(multi);
          setFactorUid(factor.uid);
          return;
        } catch {
          setError("This account is not authorized.");
          return;
        }
      }
      if (
        code === "auth/popup-blocked" ||
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        try {
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return;
        } catch {
          /* generic message below */
        }
      }
      await signOut(auth).catch(() => {});
      setError(
        cause instanceof Error &&
          (cause.message === "This account is not authorized." ||
            cause.message.includes("temporarily locked"))
          ? cause.message
          : "This account is not authorized.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function requestPasswordReset() {
    setResetBusy(true);
    setError("");
    setNotice("");
    try {
      if (email.trim()) await sendPasswordResetEmail(auth, email.trim());
      setNotice(
        "If the account is eligible, password reset instructions will be sent to the registered email address.",
      );
    } catch {
      setNotice(
        "If the account is eligible, password reset instructions will be sent to the registered email address.",
      );
    } finally {
      setResetBusy(false);
    }
  }
  useEffect(() => {
    getRedirectResult(auth)
      .then(async (result) => {
        if (result) await beginSecondFactor(result.user);
      })
      .catch(async () => {
        await signOut(auth).catch(() => {});
        setError("Unable to sign in. This account is not authorized.");
      });
  }, []);
  async function establish(idToken: string) {
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await appCheckHeaders()),
      },
      body: JSON.stringify({ idToken }),
      cache: "no-store",
    });
    if (!response.ok) {
      const d = await response.json().catch(() => null);
      throw new Error(d?.error ?? "Administrator access denied.");
    }
    await signOut(auth);
    navigate("/admin");
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const gate = await fetch("/api/admin/login-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify({ email, action: "check" }),
        cache: "no-store",
      });
      if (gate.status === 423)
        throw new Error(
          "This account is temporarily locked after repeated failed sign-ins. Try again in 15 minutes.",
        );
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await beginSecondFactor(credential.user);
    } catch (cause) {
      const authError = cause as { code?: string };
      if (
        [
          "auth/invalid-credential",
          "auth/wrong-password",
          "auth/user-not-found",
          "auth/invalid-email",
        ].includes(authError.code ?? "")
      ) {
        await fetch("/api/admin/login-check", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await appCheckHeaders()),
          },
          body: JSON.stringify({ email, action: "failure" }),
          cache: "no-store",
        }).catch(() => {});
      }
      if (authError.code === "auth/multi-factor-auth-required") {
        try {
          const multi = getMultiFactorResolver(auth, cause as MultiFactorError);
          const factor = multi.hints.find(
            (item) => item.factorId === TotpMultiFactorGenerator.FACTOR_ID,
          );
          if (!factor)
            throw new Error(
              "No supported TOTP factor is enrolled. Contact the school superadministrator.",
            );
          setResolver(multi);
          setFactorUid(factor.uid);
        } catch (err) {
          setError(err instanceof Error ? err.message : "MFA verification failed.");
        }
      } else if (cause instanceof Error && cause.message.includes("enrolled MFA factor")) {
        setError(cause.message);
        await signOut(auth);
      } else setError("Unable to sign in. Check your details or contact the school administrator.");
    } finally {
      setBusy(false);
    }
  }
  async function verifyTotp(e: FormEvent) {
    e.preventDefault();
    if (!resolver) return;
    setBusy(true);
    setError("");
    try {
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(factorUid, code.trim());
      const credential = await resolver.resolveSignIn(assertion);
      await establish(await credential.user.getIdToken(true));
    } catch {
      await fetch("/api/admin/login-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify({ email, action: "failure" }),
        cache: "no-store",
      }).catch(() => {});
      setError("The authenticator code is invalid or expired.");
    } finally {
      setBusy(false);
    }
  }
  async function enrollTotp(e: FormEvent) {
    e.preventDefault();
    if (!enrollUser || !secret) return;
    setBusy(true);
    setError("");
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim());
      await multiFactor(enrollUser).enroll(assertion, "School TOTP authenticator");
      await signOut(auth);
      setEnrollUser(null);
      setSecret(null);
      setCode("");
      setError("Authenticator enrolled. Sign in again and enter your authenticator code.");
    } catch {
      setError("Could not enroll this code. Check your authenticator clock and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link to="/" className="text-sm font-medium text-[var(--primary)] underline">
          ← Back to portal
        </Link>
        <div className="mt-5 flex flex-col items-center text-center">
          {settings.logoUrl && (
            <img
              src={settings.logoUrl}
              alt="Satyam International School logo"
              className="mb-4 h-16 w-16 rounded-xl object-contain"
            />
          )}
          <h1 className="text-2xl font-bold text-[var(--text)]">
            Satyam International School - Administrator login
          </h1>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          Authorized accounts only. Authenticator MFA is mandatory.
        </p>
        {!resolver && !enrollUser ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Email
              <input
                translate="no"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); }}
                className="mt-2 w-full rounded-lg border p-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <input
                translate="no"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); }}
                className="mt-2 min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 pr-14 text-[var(--text)]"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => { setShowPassword((value) => !value); }}
                className="mt-2 min-h-11 rounded-lg border border-[var(--border)] px-3 text-sm text-[var(--text)]"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" size={18} />
                ) : (
                  <Eye aria-hidden="true" size={18} />
                )}
              </button>
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-[var(--primary)] py-3 font-semibold text-[var(--primary-contrast)]"
            >
              {busy ? "Verifying…" : "Continue"}
            </button>
          </form>
        ) : resolver ? (
          <form onSubmit={verifyTotp} className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">
              Enter the six-digit code from your authenticator app.
            </p>
            <label className="block text-sm font-medium">
              Authenticator code
              <input
                translate="no"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => { setCode(e.target.value); }}
                className="mt-2 w-full rounded-lg border p-3 tracking-[.3em]"
              />
            </label>
            <button
              disabled={busy || code.length !== 6}
              className="w-full rounded-lg bg-[var(--primary)] py-3 font-semibold text-[var(--primary-contrast)]"
            >
              Verify and sign in
            </button>
          </form>
        ) : (
          <form onSubmit={enrollTotp} className="mt-6 space-y-4">
            <p className="text-sm text-slate-700">
              Set up your authenticator app. Add this secret manually in Google Authenticator,
              Microsoft Authenticator or another TOTP app.
            </p>
            <code className="block break-all rounded-lg bg-slate-100 p-3 text-sm">
              {secret?.secretKey}
            </code>
            <label className="block text-sm font-medium">
              Six-digit setup code
              <input
                translate="no"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => { setCode(e.target.value); }}
                className="mt-2 w-full rounded-lg border p-3 tracking-[.3em]"
              />
            </label>
            <button
              disabled={busy || code.length !== 6}
              className="w-full rounded-lg bg-[var(--primary)] py-3 font-semibold text-[var(--primary-contrast)]"
            >
              Enroll authenticator
            </button>
          </form>
        )}
        {!resolver && !enrollUser && (
          <>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={requestPasswordReset}
                disabled={resetBusy}
                className="text-sm font-semibold text-[var(--primary)] underline"
              >
                {resetBusy ? "Sending…" : "Forgot password?"}
              </button>
            </div>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-[var(--border)]" />
              <span className="text-xs text-[var(--text-muted)]">or</span>
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>
            <button
              type="button"
              onClick={() => void handleGoogle()}
              disabled={busy}
              aria-label="Sign in with Google"
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 font-semibold text-[var(--text)] disabled:opacity-60"
            >
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
              Continue with Google
            </button>
          </>
        )}
        {notice && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-[var(--success)] bg-[var(--surface-2)] p-3 text-sm text-[var(--text)]"
          >
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
