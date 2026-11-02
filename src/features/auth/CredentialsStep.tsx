"use client";

import { useState, type SyntheticEvent } from "react";

import CredentialForm from "./CredentialForm";
import PasswordResetForm from "./PasswordResetForm";

type Props = {
  busy: boolean;
  resetBusy: boolean;
  onSubmit: (email: string, password: string) => void;
  onGoogle: () => void;
  onReset: (email: string) => void;
};

export default function CredentialsStep({ busy, resetBusy, onSubmit, onGoogle, onReset }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [emailInvalid, setEmailInvalid] = useState(false);
  const [passwordInvalid, setPasswordInvalid] = useState(false);

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

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(email.trim(), password);
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
      onSubmit={submit}
      onGoogle={onGoogle}
    />
  );
}
