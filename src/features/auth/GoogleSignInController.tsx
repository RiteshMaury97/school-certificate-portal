"use client";

import {
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";

import { appCheckHeaders, auth } from "@/lib/firebase-client";

import { describeSignInError, errorCode } from "./auth-errors";
import { ADMIN_GOOGLE_SIGN_IN_EVENT } from "./google-signin-event";
import GoogleSignInDialog from "./GoogleSignInDialog";

import type { SyntheticEvent } from "react";

type EmailCodeChallenge = { challengeId: string; resendAfterSeconds: number };
type ApiResult = Record<string, unknown>;

function isRecord(value: unknown): value is ApiResult {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readJson(response: Response): Promise<ApiResult> {
  const body: unknown = await response.json().catch(() => ({}));
  return isRecord(body) ? body : {};
}

async function postJson(path: string, body: Record<string, string>): Promise<ApiResult> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(await appCheckHeaders()) },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const result = await readJson(response);
  if (!response.ok) {
    throw new Error(
      typeof result.error === "string" ? result.error : "Sign-in could not be completed.",
    );
  }
  return result;
}

async function requestEmailCode(idToken: string): Promise<EmailCodeChallenge> {
  const result = await postJson("/api/admin/otp/send", { idToken });
  if (typeof result.challengeId !== "string")
    throw new Error("The verification challenge was not created.");
  return {
    challengeId: result.challengeId,
    resendAfterSeconds:
      typeof result.resendAfterSeconds === "number" ? result.resendAfterSeconds : 60,
  };
}

function useResendCountdown(
  resendIn: number,
  setResendIn: (value: (seconds: number) => number) => void,
) {
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => {
      setResendIn((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [resendIn, setResendIn]);
}

function useGoogleStartListener(start: () => Promise<void>): void {
  useEffect(() => {
    const onStart = () => {
      void start();
    };
    window.addEventListener(ADMIN_GOOGLE_SIGN_IN_EVENT, onStart);
    return () => {
      window.removeEventListener(ADMIN_GOOGLE_SIGN_IN_EVENT, onStart);
    };
  }, [start]);
}

export default function GoogleSignInController() {
  const [idToken, setIdToken] = useState("");
  const [challenge, setChallenge] = useState<EmailCodeChallenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const active = useRef(false);
  useResendCountdown(resendIn, setResendIn);

  const clearClientAuth = useCallback(async () => {
    setIdToken("");
    await signOut(auth).catch((cause: unknown) => {
      if (cause instanceof Error) setError("Could not clear the temporary Google sign-in state.");
    });
  }, []);

  const start = useCallback(async () => {
    if (active.current) return;
    active.current = true;
    setError("");
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await signInWithPopup(auth, provider);
      await setPersistence(auth, inMemoryPersistence);
      const token = await credential.user.getIdToken(true);
      setIdToken(token);
      const nextChallenge = await requestEmailCode(token);
      setChallenge(nextChallenge);
      setResendIn(nextChallenge.resendAfterSeconds);
    } catch (cause) {
      const code = errorCode(cause);
      if (code) console.error("Google sign-in failed:", code);
      await clearClientAuth();
      setError(describeSignInError(cause, "google"));
    } finally {
      active.current = false;
      setBusy(false);
    }
  }, [clearClientAuth]);

  const submitCode = useCallback(
    async (event: SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!challenge || !idToken || busy) return;
      setBusy(true);
      setError("");
      try {
        await postJson("/api/admin/otp/verify", {
          idToken,
          challengeId: challenge.challengeId,
          code: code.trim(),
        });
        await postJson("/api/admin/session", { idToken, challengeId: challenge.challengeId });
        await clearClientAuth();
        window.location.assign("/admin");
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "The verification code could not be verified.",
        );
      } finally {
        setBusy(false);
      }
    },
    [busy, challenge, clearClientAuth, code, idToken],
  );

  const resendCode = useCallback(async () => {
    if (!idToken || busy || resendIn > 0) return;
    setBusy(true);
    setError("");
    try {
      const nextChallenge = await requestEmailCode(idToken);
      setChallenge(nextChallenge);
      setResendIn(nextChallenge.resendAfterSeconds);
      setCode("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "A new verification code could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  }, [busy, idToken, resendIn]);

  const cancel = useCallback(async () => {
    if (busy) return;
    setChallenge(null);
    setCode("");
    setError("");
    setResendIn(0);
    await clearClientAuth();
  }, [busy, clearClientAuth]);

  useGoogleStartListener(start);

  const onCancel = () => {
    void cancel();
  };
  const onResend = () => {
    void resendCode();
  };
  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    void submitCode(event);
  };

  return (
    <GoogleSignInDialog
      busy={busy}
      challengeActive={challenge !== null}
      code={code}
      error={error}
      onCancel={onCancel}
      onCodeChange={setCode}
      onResend={onResend}
      onSubmit={onSubmit}
      resendIn={resendIn}
    />
  );
}
