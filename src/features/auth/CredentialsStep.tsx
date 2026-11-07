"use client";

import { useState, type SyntheticEvent } from "react";

import AdminTurnstile, { adminCaptchaRequired } from "./AdminTurnstile";
import CredentialForm from "./CredentialForm";
import PasswordResetForm from "./PasswordResetForm";

type Props = {
  busy: boolean;
  resetBusy: boolean;
  onSubmit: (email: string, password: string, captchaToken: string) => Promise<void>;
  onGoogle: (captchaToken: string) => Promise<void>;
  onReset: (email: string) => void;
};

export default function CredentialsStep({ busy, resetBusy, onSubmit, onGoogle, onReset }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [passwordInvalid, setPasswordInvalid] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);

  if (resetMode) {
    return (
      <PasswordResetForm
        email={email}
        emailInvalid={emailInvalid}
        resetBusy={resetBusy}
        onEmailChange={setEmail}
        onEmailValidityChange={(valid) => {
          setEmailInvalid(!valid);
        }}
        onReset={onReset}
        onCancel={() => {
          setResetMode(false);
        }}
      />
    );
  }

  const submit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit(email.trim(), password, captchaToken);
    setCaptchaToken("");
    setCaptchaAttempt((value) => value + 1);
  };

  return (
    <CredentialForm
      busy={busy}
      email={email}
      password={password}
      showPassword={showPassword}
      emailInvalid={emailInvalid}
      passwordInvalid={passwordInvalid}
      onEmailChange={setEmail}
      onEmailValidityChange={(valid) => {
        setEmailInvalid(!valid);
      }}
      onPasswordChange={setPassword}
      onPasswordValidityChange={(valid) => {
        setPasswordInvalid(!valid);
      }}
      onTogglePassword={() => {
        setShowPassword((shown) => !shown);
      }}
      onForgotPassword={() => {
        setEmailInvalid(false);
        setResetMode(true);
      }}
      captcha={
        <AdminTurnstile
          attempt={captchaAttempt}
          onToken={setCaptchaToken}
          onRetry={() => {
            setCaptchaToken("");
            setCaptchaAttempt((value) => value + 1);
          }}
        />
      }
      captchaRequired={adminCaptchaRequired}
      captchaReady={!adminCaptchaRequired || Boolean(captchaToken)}
      onSubmit={submit}
      onGoogle={async () => {
        await onGoogle(captchaToken);
        setCaptchaToken("");
        setCaptchaAttempt((value) => value + 1);
      }}
    />
  );
}
