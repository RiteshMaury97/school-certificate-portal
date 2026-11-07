import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { ChangeTemporaryPasswordStep, EmailCodeStep, VerifyEmailStep } from "./CodeSteps";
import CredentialsStep from "./CredentialsStep";

import type { useAdminSignIn } from "./useAdminSignIn";

type Props = { flow: ReturnType<typeof useAdminSignIn> };

function headingForStep(step: Props["flow"]["step"]): string {
  if (step === "change-password") return "Create your password";
  if (step === "email-code") return "Verify Your Identity";
  if (step === "verify-email") return "Verify your account";
  return "Administrator Sign In";
}

export default function SignInForm({ flow }: Props) {
  return (
    <section className="flex min-h-[590px] flex-1 flex-col bg-[var(--bg)] px-4 py-4 sm:px-8 lg:min-h-0 lg:px-10 lg:py-6 xl:px-16">
      <div className="mx-auto w-full max-w-[440px] shrink-0">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center gap-2 text-xs font-medium text-[var(--primary)] no-underline outline-none transition hover:no-underline focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        >
          <ArrowLeft aria-hidden="true" size={15} /> Back to public portal
        </Link>
      </div>

      <div className="my-auto w-full py-7">
        <section
          aria-labelledby="admin-sign-in-heading"
          className="mx-auto w-full max-w-[440px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] sm:p-8"
        >
          <header className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
              Administrator Portal
            </p>
            <h2 id="admin-sign-in-heading" className="text-2xl font-semibold tracking-tight">
              {headingForStep(flow.step)}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {flow.step === "credentials"
                ? "Sign in to access the administration dashboard."
                : "Complete this step to continue."}
            </p>
          </header>

          <div key={flow.step} className="page-enter">
            {flow.step === "credentials" && (
              <CredentialsStep
                busy={flow.busy}
                resetBusy={flow.resetBusy}
                onSubmit={flow.submitCredentials}
                onGoogle={flow.signInWithGoogle}
                onReset={(email) => void flow.requestPasswordReset(email)}
              />
            )}
            {flow.step === "change-password" && (
              <ChangeTemporaryPasswordStep
                busy={flow.busy}
                onSubmit={(password) => {
                  void flow.changeTemporaryPassword(password);
                }}
                onCancel={() => {
                  void flow.cancel();
                }}
              />
            )}
            {flow.step === "email-code" && (
              <EmailCodeStep
                busy={flow.busy}
                email={flow.pendingEmail}
                onVerify={(code) => void flow.verifyCode(code)}
                onCancel={() => void flow.cancel()}
                onResend={() => void flow.resendCode()}
                resendAfterSeconds={flow.resendAfterSeconds}
              />
            )}
            {flow.step === "verify-email" && (
              <VerifyEmailStep
                email={flow.pendingEmail}
                busy={flow.busy}
                onContinue={() => void flow.continueAfterEmailVerification()}
                onCancel={() => void flow.cancel()}
              />
            )}
          </div>
          {flow.busy && flow.progress && (
            <p role="status" aria-live="polite" className="mt-4 text-sm text-[var(--text-muted)]">
              {flow.progress}
            </p>
          )}

          <p className="mt-6 flex items-center gap-2 border-t border-[var(--divider)] pt-4 text-xs leading-5 text-[var(--text-muted)]">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-[var(--primary)]" />
            Never share your password or verification code with anyone.
          </p>
        </section>
      </div>
    </section>
  );
}
