"use client";
import { getRedirectResult, GoogleAuthProvider, sendEmailVerification, reload, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, type User } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { appCheckHeaders, auth } from "@/lib/firebase-client";

import { describeSignInError, errorCode, isBadCredentials, safeNextPath } from "./auth-errors";
export type Step = "credentials" | "verify-email" | "change-password" | "email-code";
const LOCK_MESSAGE = "This account is temporarily locked after repeated failed sign-ins. Try again in 15 minutes.";
function maskEmail(value: string): string { return value.replace(/^(.).+(@.+)$/, "$1***$2"); }
function message(value: unknown): string | undefined { return typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : undefined; }
async function requestJson(path: string, body: Record<string, string>): Promise<{ response: Response; data: unknown }> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", ...(await appCheckHeaders()) }, body: JSON.stringify(body), cache: "no-store" });
  return { response, data: await response.json().catch(() => null) as unknown };
}
export function useAdminSignIn() {
  const router = useRouter(); const params = useSearchParams();
  const [step, setStep] = useState<Step>("credentials"); const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false); const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(params.get("security") === "signed-out" ? "You were signed out of all devices." : "");
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [challengeId, setChallengeId] = useState("");
  const [resendAfterSeconds, setResendAfterSeconds] = useState(60);
  const reset = useCallback((noticeText = "") => { setStep("credentials"); setPendingUser(null); setChallengeId(""); setError(""); setNotice(noticeText); }, []);
  const run = useCallback(async (action: () => Promise<void>) => { setBusy(true); setError(""); try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to complete sign-in."); } finally { setBusy(false); } }, []);
  const checkLock = async (typedEmail: string) => {
    const { response, data } = await requestJson("/api/admin/login-check", { email: typedEmail, action: "check" });
    if (response.status === 423) throw new Error(LOCK_MESSAGE);
    if (!response.ok) throw new Error(message(data) ?? "Unable to verify sign-in status.");
  };
  const begin = useCallback(async (user: User, lockAlreadyChecked = false) => {
    setPendingUser(user);
    setEmail(user.email ?? "");
    if (user.email && !lockAlreadyChecked) {
      const lock = await requestJson("/api/admin/login-check", { email: user.email, action: "check" });
      if (lock.response.status === 423) throw new Error(LOCK_MESSAGE);
      if (!lock.response.ok) throw new Error(message(lock.data) ?? "Unable to verify sign-in status.");
    }
    if (!user.emailVerified) {
      await sendEmailVerification(user);
      setStep("verify-email");
      setNotice("Verify your email address using the link we sent, then continue here.");
      return;
    }
    const idToken = await user.getIdToken();
    const tokenResult = await user.getIdTokenResult();
    if (tokenResult.claims.mustChangePassword === true) {
      setStep("change-password");
      setNotice("Choose a personal password to replace your temporary password.");
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
    if (typeof data !== "object" || data === null || !("challengeId" in data) || typeof data.challengeId !== "string") {
      await signOut(auth);
      throw new Error("Could not start email verification.");
    }
    setChallengeId(data.challengeId);
    setResendAfterSeconds(typeof data === "object" && "resendAfterSeconds" in data && typeof data.resendAfterSeconds === "number" ? data.resendAfterSeconds : 60);
    setStep("email-code");
    setNotice(`A sign-in code was sent to ${maskEmail(user.email ?? "your email")}.`);
  }, []);
  const handleError = async (cause: unknown, typedEmail: string) => {
    if (isBadCredentials(cause) && typedEmail) await requestJson("/api/admin/login-check", { email: typedEmail, action: "failure" }).catch(() => {});
    throw new Error(describeSignInError(cause, "password"));
  };
  useEffect(() => { let active = true; getRedirectResult(auth).then(async result => { if (result && active) await run(() => begin(result.user)); }).catch(cause => { if (active) setError(describeSignInError(cause, "google")); }); return () => { active = false; }; }, [begin, run]);
  const submitCredentials = (typedEmail: string, password: string) => run(async () => {
    setEmail(typedEmail); await checkLock(typedEmail);
    try { const credential = await signInWithEmailAndPassword(auth, typedEmail, password); await begin(credential.user, true); }
    catch (cause) { await handleError(cause, typedEmail); }
  });
  const signInWithGoogle = () => run(async () => {
    const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: "select_account" });
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) { await signInWithRedirect(auth, provider); return; }
    try { const credential = await signInWithPopup(auth, provider); await begin(credential.user); }
    catch (cause) { if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(errorCode(cause))) return; throw cause; }
  });
  const continueAfterEmailVerification = () => run(async () => {
    if (!pendingUser) throw new Error("Your sign-in session expired. Sign in again.");
    await reload(pendingUser);
    if (!pendingUser.emailVerified) throw new Error("Your email is not verified yet. Open the verification link and try again.");
    await begin(pendingUser);
  });
  const resendCode = () => run(async () => {
    if (!pendingUser) throw new Error("Your sign-in session expired. Sign in again.");
    const idToken = await pendingUser.getIdToken();
    const { response, data } = await requestJson("/api/admin/otp/send", { idToken });
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      if (Number.isFinite(retryAfter) && retryAfter > 0)
        setResendAfterSeconds(Math.ceil(retryAfter));
    }
    if (!response.ok) throw new Error(message(data) ?? "Could not resend the sign-in code.");
    if (typeof data !== "object" || data === null || !("challengeId" in data) || typeof data.challengeId !== "string") throw new Error("Could not start email verification.");
    setChallengeId(data.challengeId);
    setResendAfterSeconds(typeof data === "object" && "resendAfterSeconds" in data && typeof data.resendAfterSeconds === "number" ? data.resendAfterSeconds : 60);
    setNotice("A new sign-in code has been sent.");
  });
  const verifyCode = (code: string) => run(async () => {
    if (!pendingUser) throw new Error("Your sign-in session expired. Sign in again.");
    const idToken = await pendingUser.getIdToken();
    const { response: verified, data } = await requestJson("/api/admin/otp/verify", { idToken, challengeId, code });
    if (!verified.ok || typeof data !== "object" || data === null || !("verified" in data) || data.verified !== true) {
      if (verified.status === 423) throw new Error("This account is locked after too many incorrect codes. Try again later.");
      if (verified.status === 429) throw new Error("Too many attempts. Please wait before trying again.");
      throw new Error(message(data) ?? "That code is incorrect or has expired. Check it and try again.");
    }
    const { response, data: sessionData } = await requestJson("/api/admin/session", { idToken, challengeId });
    if (!response.ok) throw new Error(message(sessionData) ?? "Administrator access denied.");
    await signOut(auth); router.replace(safeNextPath(params.get("next")));
  });
  const changeTemporaryPassword = (newPassword: string) => run(async () => {
    if (!pendingUser) throw new Error("Your sign-in session expired. Sign in again.");
    const idToken = await pendingUser.getIdToken();
    const response = await fetch("/api/admin/credentials/change-temporary-password", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}`, ...(await appCheckHeaders()) },
      body: JSON.stringify({ newPassword }),
      cache: "no-store",
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(message(data) ?? "Unable to update your password.");
    await signOut(auth);
    reset("Your password has been changed. Sign in again with your new password to receive the verification code.");
  });
  const requestPasswordReset = async (typedEmail: string) => { setResetBusy(true); try { await requestJson("/api/admin/password-reset", { email: typedEmail.trim() }); } catch { /* Keep account discovery impossible. */ } finally { setNotice("If the account is eligible, password reset instructions will be sent to the registered email address."); setResetBusy(false); } };
  const cancel = async () => { await signOut(auth).catch(() => {}); reset(); };
  return { step, email, busy, resetBusy, error, notice, pendingEmail: pendingUser?.email ?? email, resendAfterSeconds, continueAfterEmailVerification, resendCode, submitCredentials, signInWithGoogle, verifyCode, changeTemporaryPassword, cancel, requestPasswordReset };
}
