"use client";
import {
  getRedirectResult,
  GoogleAuthProvider,
  sendEmailVerification,
  reload,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { toast } from "@/components/ui/toast";
import { appCheckHeaders, auth } from "@/lib/firebase-client";

import { describeSignInError, errorCode, isBadCredentials, safeNextPath } from "./auth-errors";
export type Step = "credentials" | "verify-email" | "change-password" | "email-code";
const LOCK_MESSAGE =
  "This account is temporarily locked after repeated failed sign-ins. Try again in 15 minutes.";
function maskEmail(value: string): string {
  return value.replace(/^(.).+(@.+)$/, "$1***$2");
}
function ignoreBestEffortFailure(): void {
  /* The primary action remains authoritative. */
}
function message(value: unknown): string | undefined {
  return typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
    ? value.error
    : undefined;
}
async function requestJson(
  path: string,
  body: Record<string, string>,
): Promise<{ response: Response; data: unknown }> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await appCheckHeaders()) },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return { response, data: (await response.json().catch(() => null)) as unknown };
}

function parseChallenge(data: unknown): { challengeId: string; resendAfterSeconds: number } {
  if (
    typeof data !== "object" ||
    data === null ||
    !("challengeId" in data) ||
    typeof data.challengeId !== "string"
  ) {
    throw new Error("Could not start email verification.");
  }
  return {
    challengeId: data.challengeId,
    resendAfterSeconds:
      "resendAfterSeconds" in data && typeof data.resendAfterSeconds === "number"
        ? data.resendAfterSeconds
        : 60,
  };
}

function getRetryAfterSeconds(response: Response): number | undefined {
  if (response.status !== 429) return undefined;
  const retryAfter = Number(response.headers.get("Retry-After"));
  return Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : undefined;
}
// eslint-disable-next-line max-lines-per-function -- reason: this hook coordinates the existing multi-step authentication state and handlers.
export function useAdminSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const signedOut = params.get("security") === "signed-out";
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [resendAfterSeconds, setResendAfterSeconds] = useState(60);
  useEffect(() => {
    if (signedOut) toast.add({ type: "info", title: "You were signed out of all devices." });
  }, [signedOut]);
  const reset = useCallback((noticeText = "") => {
    setStep("credentials");
    setPendingUser(null);
    setChallengeId("");
    if (noticeText) toast.add({ type: "success", title: noticeText });
  }, []);
  const run = useCallback(async (action: () => Promise<void>, failureTitle = "Sign in failed") => {
    setBusy(true);
    try {
      await action();
    } catch (cause) {
      toast.add({
        type: "error",
        title: failureTitle,
        description: cause instanceof Error ? cause.message : "Unable to complete sign-in.",
      });
    } finally {
      setBusy(false);
    }
  }, []);
  const checkLock = async (typedEmail: string) => {
    const { response, data } = await requestJson("/api/admin/login-check", {
      email: typedEmail,
      action: "check",
    });
    if (response.status === 423) throw new Error(LOCK_MESSAGE);
    if (!response.ok) throw new Error(message(data) ?? "Unable to verify sign-in status.");
  };
  // eslint-disable-next-line complexity -- reason: this preserves the ordered authentication, authorization, and OTP steps.
  const begin = useCallback(async (user: User, lockAlreadyChecked = false) => {
    setPendingUser(user);
    setEmail(user.email ?? "");
    if (user.email && !lockAlreadyChecked) {
      const lock = await requestJson("/api/admin/login-check", {
        email: user.email,
        action: "check",
      });
      if (lock.response.status === 423) throw new Error(LOCK_MESSAGE);
      if (!lock.response.ok)
        throw new Error(message(lock.data) ?? "Unable to verify sign-in status.");
    }
    if (!user.emailVerified) {
      await sendEmailVerification(user);
      setStep("verify-email");
      toast.add({
        type: "info",
        title: "Verify your email address",
        description: "Use the link we sent, then continue here.",
      });
      return;
    }
    const idToken = await user.getIdToken();
    const tokenResult = await user.getIdTokenResult();
    if (tokenResult.claims.mustChangePassword === true) {
      setStep("change-password");
      toast.add({
        type: "info",
        title: "Create a personal password",
        description: "Replace your temporary password before continuing.",
      });
      return;
    }
    const preflight = await fetch("/api/admin/preflight", {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}`, ...(await appCheckHeaders()) },
      cache: "no-store",
    });
    if (!preflight.ok) {
      await signOut(auth);
      throw new Error("This account is not authorized.");
    }
    const { response, data } = await requestJson("/api/admin/otp/send", { idToken });
    if (!response.ok) {
      await signOut(auth);
      throw new Error(message(data) ?? "Could not send the sign-in code.");
    }
    let challenge: { challengeId: string; resendAfterSeconds: number };
    try {
      challenge = parseChallenge(data);
    } catch (cause) {
      await signOut(auth);
      throw cause;
    }
    setChallengeId(challenge.challengeId);
    setResendAfterSeconds(challenge.resendAfterSeconds);
    setStep("email-code");
    toast.add({
      type: "info",
      title: "Sign-in code sent",
      description: `Check ${maskEmail(user.email ?? "your email")}.`,
    });
  }, []);
  const handleError = async (cause: unknown, typedEmail: string) => {
    if (isBadCredentials(cause) && typedEmail)
      await requestJson("/api/admin/login-check", { email: typedEmail, action: "failure" }).catch(
        ignoreBestEffortFailure,
      );
    throw new Error(describeSignInError(cause, "password"));
  };
  useEffect(() => {
    let active = true;
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && active) await run(() => begin(result.user), "Google sign-in failed");
      })
      .catch((cause: unknown) => {
        if (active)
          toast.add({
            type: "error",
            title: "Google sign-in failed",
            description: describeSignInError(cause, "google"),
          });
      });
    return () => {
      active = false;
    };
  }, [begin, run]);
  const submitCredentials = (typedEmail: string, password: string) =>
    run(async () => {
      setEmail(typedEmail);
      await checkLock(typedEmail);
      try {
        const credential = await signInWithEmailAndPassword(auth, typedEmail, password);
        await begin(credential.user, true);
      } catch (cause) {
        await handleError(cause, typedEmail);
      }
    });
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
        await begin(credential.user);
      } catch (cause) {
        if (
          ["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(errorCode(cause))
        )
          return;
        throw cause;
      }
    }, "Google sign-in failed");
  const continueAfterEmailVerification = () =>
    run(async () => {
      if (!pendingUser) throw new Error("Your sign-in session expired. Sign in again.");
      await reload(pendingUser);
      if (!pendingUser.emailVerified)
        throw new Error(
          "Your email is not verified yet. Open the verification link and try again.",
        );
      await begin(pendingUser);
    });
  const resendCode = () =>
    run(async () => {
      if (!pendingUser) throw new Error("Your sign-in session expired. Sign in again.");
      const idToken = await pendingUser.getIdToken();
      const { response, data } = await requestJson("/api/admin/otp/send", { idToken });
      const retryAfter = getRetryAfterSeconds(response);
      if (retryAfter) setResendAfterSeconds(retryAfter);
      if (!response.ok) throw new Error(message(data) ?? "Could not resend the sign-in code.");
      const challenge = parseChallenge(data);
      setChallengeId(challenge.challengeId);
      setResendAfterSeconds(challenge.resendAfterSeconds);
      toast.add({ type: "success", title: "A new sign-in code has been sent" });
    });
  const verifyCode = (code: string) =>
    run(async () => {
      if (!pendingUser) throw new Error("Your sign-in session expired. Sign in again.");
      const idToken = await pendingUser.getIdToken();
      const { response: verified, data } = await requestJson("/api/admin/otp/verify", {
        idToken,
        challengeId,
        code,
      });
      if (
        !verified.ok ||
        typeof data !== "object" ||
        data === null ||
        !("verified" in data) ||
        data.verified !== true
      ) {
        if (verified.status === 423)
          throw new Error(
            "This account is locked after too many incorrect codes. Try again later.",
          );
        if (verified.status === 429)
          throw new Error("Too many attempts. Please wait before trying again.");
        throw new Error(
          message(data) ?? "That code is incorrect or has expired. Check it and try again.",
        );
      }
      const { response, data: sessionData } = await requestJson("/api/admin/session", {
        idToken,
        challengeId,
      });
      if (!response.ok) throw new Error(message(sessionData) ?? "Administrator access denied.");
      await signOut(auth);
      router.replace(safeNextPath(params.get("next")));
    });
  const changeTemporaryPassword = (newPassword: string) =>
    run(async () => {
      if (!pendingUser) throw new Error("Your sign-in session expired. Sign in again.");
      const idToken = await pendingUser.getIdToken();
      const response = await fetch("/api/admin/credentials/change-temporary-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify({ newPassword }),
        cache: "no-store",
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(message(data) ?? "Unable to update your password.");
      await signOut(auth);
      reset("Password changed. Sign in again with your new password.");
    });
  const requestPasswordReset = async (typedEmail: string) => {
    setResetBusy(true);
    try {
      const { response } = await requestJson("/api/admin/password-reset", {
        email: typedEmail.trim(),
      });
      if (!response.ok) throw new Error("The reset request could not be completed.");
      toast.add({
        type: "info",
        title: "Password reset requested",
        description:
          "If the account is eligible, instructions will be sent to its registered email.",
      });
    } catch {
      toast.add({
        type: "error",
        title: "Password reset unavailable",
        description: "Unable to send a reset request. Check your connection and try again.",
      });
    } finally {
      setResetBusy(false);
    }
  };
  const cancel = async () => {
    await signOut(auth).catch(ignoreBestEffortFailure);
    reset();
  };
  return {
    step,
    email,
    busy,
    resetBusy,
    pendingEmail: pendingUser?.email ?? email,
    resendAfterSeconds,
    continueAfterEmailVerification,
    resendCode,
    submitCredentials,
    signInWithGoogle,
    verifyCode,
    changeTemporaryPassword,
    cancel,
    requestPasswordReset,
  };
}
