"use client";
import Link from "next/link";
import SiteShell from "@/components/layout/SiteShell";
import { usePublicSiteSettings } from "@/lib/use-site-settings";

export default function HomePage() {
  const settings = usePublicSiteSettings();
  return (
    <SiteShell>
      <section className="overflow-hidden rounded-3xl bg-[var(--primary)] px-6 py-14 text-[var(--on-primary)] shadow-lg sm:px-12 sm:py-20">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-[var(--on-primary)]">
          Official school services
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Welcome to {settings.schoolName?.trim() || "Satyam International School"}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--on-primary)]">
          Access school certificates securely and verify issued records through our official digital
          services.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/certificates"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--surface)] px-6 py-3 font-semibold text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            Find my certificates
          </Link>
          <Link
            href="/verify"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--on-primary)_50%,transparent)] px-6 py-3 font-semibold text-[var(--on-primary)] hover:bg-[color-mix(in_srgb,var(--surface)_10%,transparent)]"
          >
            Verify a certificate
          </Link>
        </div>
      </section>
      <section className="mt-12">
        <h2 className="text-2xl font-bold text-[var(--text)]">How it works</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {[
            [
              "01",
              "Enter your details",
              "Provide the student and guardian details exactly as recorded by the school.",
            ],
            [
              "02",
              "Complete verification",
              "Complete the security check so we can safely match the school record.",
            ],
            [
              "03",
              "View and download",
              "Review available certificates and download verified copies.",
            ],
          ].map(([number, title, description]) => (
            <article
              key={number}
              className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-6 shadow-sm"
            >
              <span className="text-sm font-bold text-[var(--text)]">{number}</span>
              <h3 className="mt-3 text-lg font-bold text-[var(--text)]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
            </article>
          ))}
        </div>
      </section>
      {(settings.address?.trim() ||
        settings.phone?.trim() ||
        settings.email?.trim() ||
        settings.boardName?.trim() ||
        settings.affiliationNumber) && (
        <section className="mt-12 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-6">
          <h2 className="text-xl font-bold text-[var(--text)]">School information</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {settings.address?.trim() && (
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Address</dt>
                <dd className="mt-1 text-sm">{settings.address}</dd>
              </div>
            )}
            {settings.phone?.trim() && (
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Phone</dt>
                <dd className="mt-1 text-sm">{settings.phone}</dd>
              </div>
            )}
            {settings.email?.trim() && (
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Email</dt>
                <dd className="mt-1 text-sm">{settings.email}</dd>
              </div>
            )}
            {settings.boardName?.trim() && (
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Board</dt>
                <dd className="mt-1 text-sm">{settings.boardName}</dd>
              </div>
            )}
            {settings.affiliationNumber?.trim() && (
              <div>
                <dt className="text-xs text-[var(--text-muted)]">Affiliation number</dt>
                <dd className="mt-1 text-sm">{settings.affiliationNumber}</dd>
              </div>
            )}
          </dl>
        </section>
      )}
      <section className="mt-12 rounded-2xl bg-[var(--surface-2)] p-6 sm:p-8">
        <h2 className="text-xl font-bold text-[var(--text)]">Need help?</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Find answers to common questions or contact the school for assistance.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-[var(--text)]">
          <Link href="/faq">Frequently asked questions</Link>
          <Link href="/contact">Contact support</Link>
          <Link href="/data-rights">Data rights requests</Link>
        </div>
      </section>
    </SiteShell>
  );
}
