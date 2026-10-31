import { ArrowLeft, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { EmailCodeStep, VerifyEmailStep } from "./CodeSteps";
import CredentialsStep from "./CredentialsStep";

import type { useAdminSignIn } from "./useAdminSignIn";
import type { PublicSiteSettings } from "@/lib/use-site-settings";

type Props = {
  settings: PublicSiteSettings;
  flow: ReturnType<typeof useAdminSignIn>;
};

function settingOr(value: string | undefined, fallback: string): string {
  if (value?.trim()) return value.trim();
  return fallback;
}

export default function AdminAuthSignInPanel({ settings, flow }: Props) {
  const supportEmail = settingOr(settings.email, "sischoolzam@gmail.com");
  return (
    <section className="flex h-full min-h-0 flex-col overflow-y-auto px-5 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-10 lg:px-12 xl:px-20">
      <div className="mx-auto flex w-full max-w-xl items-center justify-between">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[#315d4c] hover:text-[#183c2e]">
          <ArrowLeft size={16} aria-hidden="true" /> Back to public portal
        </Link>
        <span className="hidden text-[10px] uppercase tracking-[0.12em] text-[#718078] sm:inline">SIS <span className="px-1 text-[#b6c0b9]">/</span> Admin portal</span>
      </div>

      <div className="mx-auto my-auto w-full max-w-xl py-5 sm:py-7">
        <header className="mb-7">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#e4efe9] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#315d4c]">
            <ShieldCheck size={13} aria-hidden="true" /> Administrator access
          </span>
          <h1 className="mt-5 text-3xl font-medium tracking-tight sm:text-4xl">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-[#718078]">Sign in to your school administration account to continue.</p>
          <p className="mt-2 text-xs leading-5 text-[#89958e]">A six-digit verification code will be sent to your registered email after sign-in.</p>
        </header>

        <div className="rounded-2xl border border-[#e1e8e3] bg-white p-5 shadow-[0_18px_50px_-35px_rgba(20,37,30,0.35)] sm:p-7">
          <h2 className="text-base font-semibold">{flow.step === "credentials" ? "Administrator sign in" : "Verify your account"}</h2>
          <p className="mt-1 text-xs leading-5 text-[#87938c]">
            {flow.step === "credentials" ? "Use your authorized school account credentials." : "Complete the secure verification step to continue."}
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

          <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#e7f1eb] p-3 text-[#315d4c]">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#315d4c] text-white"><Check size={12} aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-semibold">Email verification enabled</p>
              <p className="mt-1 text-[10px] leading-4 text-[#718078]">A six-digit one-time code is required after password sign-in.</p>
            </div>
          </div>
          {flow.notice && <p role="status" className="mt-4 rounded-lg border border-[var(--success)] bg-[var(--surface-2)] p-3 text-sm text-[var(--text)]">{flow.notice}</p>}
          {flow.error && <p role="alert" className="mt-4 rounded-lg bg-[#fff0ed] p-3 text-sm text-[#a33425]">{flow.error}</p>}
        </div>

        <div className="mt-6 flex flex-col gap-4 text-xs text-[#7c8981] sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p>Need help accessing your account?</p>
            <a className="mt-1 inline-block font-medium text-[#315d4c] hover:underline" href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </div>
          <a href="https://sischool.in" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[#315d4c]">Visit sischool.in <ArrowUpRight size={13} aria-hidden="true" /></a>
        </div>
        <p className="mt-6 text-[10px] text-[#9aa49e]">Protected school administration · Authorized users only</p>
      </div>
    </section>
  );
}
