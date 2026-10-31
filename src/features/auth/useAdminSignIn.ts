"use client";
import { useCallback, useEffect, useState } from "react";
import {
  getMultiFactorResolver,
  getRedirectResult,
  GoogleAuthProvider,
  multiFactor,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
  type TotpSecret,
  type User,
} from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { appCheckHeaders, auth } from "@/lib/firebase-client";
import {
  describeEnrollError,
  describeSignInError,
  errorCode,
  isBadCredentials,
  isMfaRequired,
  safeNextPath,
} from "./auth-errors";

export type Step = "credentials" | "mfa" | "verify-email" | "enroll";
const LOCK_MESSAGE =
  "This account is temporarily locked after repeated failed sign-ins. Try again in 15 minutes.";
const ISSUER = "School Portal";

async function postLoginCheck(email: string, action: "check" | "failure"): Promise<Response> {
  return fetch("/api/admin/login-check", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await appCheckHeaders()) },
    body: JSON.stringify({ email, action }),
    cache: "no-store",
  });
}

export function useAdminSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    params.get("security") === "signed-out" ? "You were signed out of all devices." : "",
  );
  const [resolver, setResolver] = useState<MultiFactorResolver | null>(null);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [secret, setSecret] = useState<TotpSecret | null>(null);

  const reset = useCallback((message = "") => {
    setStep("credentials");
    setResolver(null);
    setPendingUser(null);
    setSecret(null);
    setError("");
    setNotice(message);
  }, []);

  /** Runs an async action with busy/error handling shared by every step. */
  const run = useCallback(async (action: () => Promise<void>, describe: (c: unknown) => string) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusy(false);
    }
  }, []);

  const beginEnrollment = useCallback(async (user: User) => {
    const preflight = await fetch("/api/admin/preflight", {
      method: "POST",
      headers: { Authorization: `Bearer ${await user.getIdToken(true)}`, ...(await appCheckHeaders()) },
      cache: "no-store",
    });
    if (!preflight.ok) {
      await signOut(auth);
      throw new Error("This account is not authorized.");
    }
    setPendingUser(user);
    if (!user.emailVerified) {
      await sendEmailVerification(user);
      setNotice(`We sent a verification link to ${user.email ?? "your email"}. Open it, then continue.`);
      setStep("verify-email");
      return;
    }
    const generated = await TotpMultiFactorGenerator.generateSecret(await multiFactor(user).getSession());
    setSecret(generated);
    setNotice("Set up your authenticator app. You will sign in again afterwards.");
    setStep("enroll");
  }, []);

  const acceptCredential = useCallback(
    async (user: User) => {
      const gate = await postLoginCheck(user.email ?? "", "check");
      if (gate.status === 423) {
        await signOut(auth);
        throw new Error(LOCK_MESSAGE);
      }
      await beginEnrollment(user);
    },
    [beginEnrollment],
  );

  const handleFirebaseError = useCallback(
    async (cause: unknown, typedEmail: string) => {
      if (isMfaRequired(cause)) {
        const multi = getMultiFactorResolver(auth, cause as MultiFactorError);
        const hint = multi.hints.find((item) => item.factorId === TotpMultiFactorGenerator.FACTOR_ID);
        if (!hint) throw new Error("No authenticator is enrolled. Contact the school superadministrator.");
        setResolver(multi);
        setStep("mfa");
        return;
      }
      if (isBadCredentials(cause) && typedEmail)
        await postLoginCheck(typedEmail, "failure").catch(() => undefined);
      throw cause;
    },
    [],
  );

  // Mobile Google sign-in returns here after a full-page redirect.
  useEffect(() => {
    let live = true;
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && live) await run(() => acceptCredential(result.user), describeSignInError);
      })
      .catch(async (cause) => {
        if (!live) return;
        await run(() => handleFirebaseError(cause, ""), describeSignInError);
      });
    return () => {
      live = false;
    };
  }, [acceptCredential, handleFirebaseError, run]);

  const submitCredentials = (typedEmail: string, password: string) =>
    run(async () => {
      setEmail(typedEmail);
      const gate = await postLoginCheck(typedEmail, "check");
      if (gate.status === 423) throw new Error(LOCK_MESSAGE);
      try {
        const credential = await signInWithEmailAndPassword(auth, typedEmail, password);
        await acceptCredential(credential.user);
      } catch (cause) {
        await handleFirebaseError(cause, typedEmail);
      }
    }, describeSignInError);

  const signInWithGoogle = () =>
    run(async () => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      try {
        const credential = await signInWithPopup(auth, provider);
        await acceptCredential(credential.user);
      } catch (cause) {
        if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(errorCode(cause))) return;
        await handleFirebaseError(cause, "");
      }
    }, describeSignInError);

  const verifyCode = (code: string) =>
    run(async () => {
      if (!resolver) return;
      const hint = resolver.hints.find((item) => item.factorId === TotpMultiFactorGenerator.FACTOR_ID);
      if (!hint) throw new Error("No authenticator is enrolled.");
      let idToken: string;
      try {
        const credential = await resolver.resolveSignIn(
          TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code.trim()),
        );
        idToken = await credential.user.getIdToken(true);
      } catch (cause) {
        if (errorCode(cause) === "auth/invalid-verification-code" && email)
          await postLoginCheck(email, "failure").catch(() => undefined);
        throw cause;
      }
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await appCheckHeaders()) },
        body: JSON.stringify({ idToken }),
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Administrator access denied.");
      await signOut(auth); // the server cookie is now the only credential
      router.replace(safeNextPath(params.get("next")));
    }, (cause) =>
      errorCode(cause) === "auth/invalid-verification-code" || errorCode(cause) === "auth/code-expired"
        ? "The authenticator code is invalid or expired. Enter the current 6-digit code."
        : describeSignInError(cause));

  const continueAfterEmailVerified = () =>
    run(async () => {
      if (!pendingUser) return;
      await pendingUser.reload();
      if (!pendingUser.emailVerified) throw new Error("Your email is not verified yet. Open the link we emailed you.");
      await pendingUser.getIdToken(true);
      await beginEnrollment(pendingUser);
    }, describeEnrollError);

  const resendVerification = () =>
    run(async () => {
      if (!pendingUser) return;
      await sendEmailVerification(pendingUser);
      setNotice("Verification email sent again.");
    }, describeEnrollError);

  const enroll = (code: string) =>
    run(async () => {
      if (!pendingUser || !secret) return;
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, code.trim());
      await multiFactor(pendingUser).enroll(assertion, "Authenticator app");
      await signOut(auth);
      reset("Authenticator set up. Sign in again and enter your authenticator code.");
    }, describeEnrollError);

  const requestPasswordReset = async (typedEmail: string) => {
    setResetBusy(true);
    setError("");
    try {
      if (typedEmail.trim()) await sendPasswordResetEmail(auth, typedEmail.trim());
    } catch {
      /* Same message either way so accounts cannot be probed. */
    } finally {
      setNotice("If the account is eligible, password reset instructions will be sent to the registered email address.");
      setResetBusy(false);
    }
  };

  const cancel = async () => {
    await signOut(auth).catch(() => undefined);
    reset();
  };

  return {
    step, email, busy, resetBusy, error, notice,
    otpauthUri: secret && pendingUser?.email ? secret.generateQrCodeUrl(pendingUser.email, ISSUER) : "",
    secretKey: secret?.secretKey ?? "",
    pendingEmail: pendingUser?.email ?? "",
    submitCredentials, signInWithGoogle, verifyCode, enroll, cancel,
    continueAfterEmailVerified, resendVerification, requestPasswordReset,
  };
}
