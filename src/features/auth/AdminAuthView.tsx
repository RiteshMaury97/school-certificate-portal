"use client";
import Link from "next/link";
import { usePublicSiteSettings } from "@/lib/use-site-settings";
import CredentialsStep from "./CredentialsStep";
import { EnrollStep, MfaStep, VerifyEmailStep } from "./CodeSteps";
import { useAdminSignIn } from "./useAdminSignIn";

export default function AdminAuthView() {
  const settings = usePublicSiteSettings();
  const flow = useAdminSignIn();
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="grid min-h-screen place-items-center bg-[var(--bg)] px-5 py-10"
    >
      <div className="w-full max-w-md rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-8 shadow-[var(--shadow-card)]">
        <Link href="/" className="text-sm font-medium text-[var(--text)] underline">
          ← Back to portal
        </Link>
        <div className="mt-5 flex flex-col items-center text-center">
          {settings.logoUrl && (
            <img
              src={settings.logoUrl}
              alt="School logo"
              className="mb-4 h-16 w-16 rounded-xl object-contain"
            />
          )}
          <h1 className="text-2xl font-bold text-[var(--text)]">
            {settings.schoolName ?? "Satyam International School"} – Administrator login
          </h1>
        </div>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Authorized accounts only. Authenticator MFA is mandatory.
        </p>
        <div key={flow.step} className="page-enter">
          {flow.step === "credentials" && (
            <CredentialsStep
              busy={flow.busy}
              resetBusy={flow.resetBusy}
              onSubmit={(email, password) => void flow.submitCredentials(email, password)}
              onGoogle={() => void flow.signInWithGoogle()}
              onReset={(email) => void flow.requestPasswordReset(email)}
            />
          )}
          {flow.step === "mfa" && (
            <MfaStep busy={flow.busy} onVerify={(code) => void flow.verifyCode(code)} onCancel={() => void flow.cancel()} />
          )}
          {flow.step === "verify-email" && (
            <VerifyEmailStep
              busy={flow.busy}
              email={flow.pendingEmail}
              onContinue={() => void flow.continueAfterEmailVerified()}
              onResend={() => void flow.resendVerification()}
              onCancel={() => void flow.cancel()}
            />
          )}
          {flow.step === "enroll" && (
            <EnrollStep
              busy={flow.busy}
              secretKey={flow.secretKey}
              otpauthUri={flow.otpauthUri}
              onEnroll={(code) => void flow.enroll(code)}
              onCancel={() => void flow.cancel()}
            />
          )}
        </div>
        {flow.notice && (
          <p role="status" className="mt-4 rounded-lg border border-[var(--success)] bg-[var(--surface-2)] p-3 text-sm text-[var(--text)]">
            {flow.notice}
          </p>
        )}
        {flow.error && (
          <p role="alert" className="mt-4 rounded-lg bg-[var(--surface-2)] p-3 text-sm text-[var(--text)]">
            {flow.error}
          </p>
        )}
      </div>
    </main>
  );
}
