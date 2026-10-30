"use client";
import { FormEvent, useState } from "react";
import {
  getMultiFactorResolver,
  multiFactor,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
} from "firebase/auth";
import type { MultiFactorError, User } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { appCheckHeaders, auth } from "@/src/lib/firebase-client";
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resolver, setResolver] = useState<ReturnType<
    typeof getMultiFactorResolver
  > | null>(null);
  const [factorUid, setFactorUid] = useState("");
  const [enrollUser, setEnrollUser] = useState<User | null>(null);
  const [secret, setSecret] = useState<Awaited<
    ReturnType<typeof TotpMultiFactorGenerator.generateSecret>
  > | null>(null);
  const navigate = useNavigate();
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
      const credential = await signInWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const preflight = await fetch("/api/admin/preflight", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await credential.user.getIdToken(true)}`,
          ...(await appCheckHeaders()),
        },
      });
      if (!preflight.ok)
        throw new Error(
          "This account is not authorized as a school administrator.",
        );
      const enrolled = multiFactor(credential.user).enrolledFactors;
      const totp = enrolled.find(
        (f) => f.factorId === TotpMultiFactorGenerator.FACTOR_ID,
      );
      if (totp)
        throw new Error(
          "Your account has an enrolled MFA factor. Sign in again to complete the authenticator challenge.",
        );
      const session = await multiFactor(credential.user).getSession();
      const generated = await TotpMultiFactorGenerator.generateSecret(session);
      setEnrollUser(credential.user);
      setSecret(generated);
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
        }).catch(() => undefined);
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
          setError(
            err instanceof Error ? err.message : "MFA verification failed.",
          );
        }
      } else if (
        cause instanceof Error &&
        cause.message.includes("enrolled MFA factor")
      ) {
        setError(cause.message);
        await signOut(auth);
      } else
        setError(cause instanceof Error ? cause.message : "Unable to sign in.");
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
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        factorUid,
        code.trim(),
      );
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
      }).catch(() => undefined);
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
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        secret,
        code.trim(),
      );
      await multiFactor(enrollUser).enroll(
        assertion,
        "School TOTP authenticator",
      );
      await signOut(auth);
      setEnrollUser(null);
      setSecret(null);
      setCode("");
      setError(
        "Authenticator enrolled. Sign in again and enter your authenticator code.",
      );
    } catch {
      setError(
        "Could not enroll this code. Check your authenticator clock and try again.",
      );
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
        <Link to="/" className="text-sm text-blue-800">
          ← Back to portal
        </Link>
        <h1 className="mt-6 text-2xl font-bold">Administrator login</h1>
        <p className="mt-2 text-sm text-slate-600">
          Authorized accounts only. Authenticator MFA is mandatory.
        </p>
        {!resolver && !enrollUser ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border p-3"
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-lg border p-3"
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-lg bg-[#173b68] py-3 font-semibold text-white"
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
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-2 w-full rounded-lg border p-3 tracking-[.3em]"
              />
            </label>
            <button
              disabled={busy || code.length !== 6}
              className="w-full rounded-lg bg-[#173b68] py-3 font-semibold text-white"
            >
              Verify and sign in
            </button>
          </form>
        ) : (
          <form onSubmit={enrollTotp} className="mt-6 space-y-4">
            <p className="text-sm text-slate-700">
              Set up your authenticator app. Add this secret manually in Google
              Authenticator, Microsoft Authenticator or another TOTP app.
            </p>
            <code className="block break-all rounded-lg bg-slate-100 p-3 text-sm">
              {secret?.secretKey}
            </code>
            <label className="block text-sm font-medium">
              Six-digit setup code
              <input
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="mt-2 w-full rounded-lg border p-3 tracking-[.3em]"
              />
            </label>
            <button
              disabled={busy || code.length !== 6}
              className="w-full rounded-lg bg-[#173b68] py-3 font-semibold text-white"
            >
              Enroll authenticator
            </button>
          </form>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900"
          >
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
