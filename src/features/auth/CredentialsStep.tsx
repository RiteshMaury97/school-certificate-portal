"use client";

import { useState, type SyntheticEvent } from "react";

import AdminTurnstile, { adminCaptchaRequired } from "./AdminTurnstile";
import CredentialForm from "./CredentialForm";
type Props = {
  busy: boolean;
  onSubmit: (email: string, password: string, captchaToken: string) => Promise<void>;
  onGoogle: () => Promise<void>;
};

export default function CredentialsStep({ busy, onSubmit, onGoogle }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [passwordInvalid, setPasswordInvalid] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
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
      onSubmit={(event) => {
        void submit(event);
      }}
      onGoogle={() => {
        void onGoogle();
      }}
    />
  );
}
