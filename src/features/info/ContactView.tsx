"use client";

import { ArrowRight, Clock3, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import SiteShell from "@/components/layout/SiteShell";
import { useT } from "@/i18n/locale-provider";
import { usePublicSiteSettings } from "@/lib/use-site-settings";

import ContactEnquiryForm from "./ContactEnquiryForm";

function settingOr(value: string | undefined, fallback: string): string {
  const cleaned = value?.trim();
  return cleaned && cleaned.length > 0 ? cleaned : fallback;
}

export default function ContactView() {
  const t = useT();
  const settings = usePublicSiteSettings();
  const schoolName = settingOr(settings.schoolName, "Satyam International School");
  const address = settingOr(settings.address, "Lodipur, Zamania, Ghazipur, Uttar Pradesh 232329");
  const phone = settingOr(settings.phone, "+91 9336950476");
  const email = settingOr(settings.email, "sischoolzam@gmail.com");
  const mapUrl = settingOr(
    settings.mapUrl,
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${schoolName}, ${address}`)}`,
  );

  return (
    <SiteShell>
      <div className="mx-auto max-w-6xl">
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("contact.supportHeading")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <header className="rounded-3xl bg-[var(--primary)] px-6 py-8 text-[var(--on-primary)] shadow-[var(--shadow-card)] sm:px-9 sm:py-10">
          <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color-mix(in_srgb,var(--on-primary)_75%,transparent)]">
                We’re here to help
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                Let’s get you the right support.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[color-mix(in_srgb,var(--on-primary)_82%,transparent)]">
                Questions about certificates, student records or school services? Contact{" "}
                {schoolName} using the details below.
              </p>
            </div>
            <div className="rounded-2xl border border-[color-mix(in_srgb,var(--on-primary)_12%,transparent)] bg-[color-mix(in_srgb,var(--on-primary)_8%,transparent)] p-5">
              <p className="text-xl font-bold">SIS</p>
              <p className="mt-1 text-xs font-medium">Student &amp; parent support</p>
              <p className="mt-2 text-[10px] text-[color-mix(in_srgb,var(--on-primary)_75%,transparent)]">
                Lodipur · Zamania · Ghazipur
              </p>
            </div>
          </div>
        </header>

        <section aria-label={t("contact.contactOptions")} className="mt-5 grid gap-3 md:grid-cols-3">
          <a
            href={`tel:${phone}`}
            className="group flex min-h-24 items-center gap-3 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm transition hover:border-[var(--primary)]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]">
              <Phone size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Call the school
              </span>
              <span className="mt-1 block text-sm font-semibold text-[var(--text)]">{phone}</span>
              <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                Tap to call the school office
              </span>
            </span>
          </a>
          <a
            href={`mailto:${email}`}
            className="group flex min-h-24 items-center gap-3 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm transition hover:border-[var(--primary)]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]">
              <Mail size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Email the office
              </span>
              <span className="mt-1 block break-all text-sm font-semibold text-[var(--text)]">
                {email}
              </span>
              <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                For enquiries and record-related support
              </span>
            </span>
          </a>
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-24 items-center gap-3 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-4 shadow-sm transition hover:border-[var(--primary)]"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]">
              <MapPin size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Visit the campus
              </span>
              <span className="mt-1 block text-sm font-semibold text-[var(--text)]">
                Lodipur, Zamania
              </span>
              <span className="mt-1 block text-[10px] text-[var(--text-muted)]">
                Ghazipur, Uttar Pradesh · PIN 232329
              </span>
            </span>
          </a>
        </section>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,.9fr)]">
          <div className="space-y-4">
            <ContactEnquiryForm />
            <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5">
              <h2 className="text-sm font-bold text-[var(--text)]">Need another service?</h2>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-[var(--primary)]">
                <Link href="/certificates" className="inline-flex items-center gap-1">
                  {t("footer.findCertificates")} <ArrowRight size={12} aria-hidden="true" />
                </Link>
                <Link href="/report-wrong-record" className="inline-flex items-center gap-1">
                  Report a record issue <ArrowRight size={12} aria-hidden="true" />
                </Link>
                <Link href="/faq" className="inline-flex items-center gap-1">
                  Browse FAQs <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm">
              <h2 className="text-sm font-bold text-[var(--text)]">School office details</h2>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">
                {schoolName}
              </p>
              <p className="mt-2 text-xs leading-5 text-[var(--text)]">{address}</p>
              <div className="my-4 border-t border-[var(--divider)]" />
              <dl className="space-y-3 text-xs">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Phone
                  </dt>
                  <dd className="mt-1 text-[var(--text)]">{phone}</dd>
                </div>
                {settings.officeHours?.trim() && (
                  <div>
                    <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      <Clock3 size={12} aria-hidden="true" /> Office hours
                    </dt>
                    <dd className="mt-1 text-[var(--text)]">{settings.officeHours}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Email
                  </dt>
                  <dd className="mt-1 break-all text-[var(--text)]">{email}</dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl bg-[var(--surface-2)] p-5">
              <h2 className="text-sm font-bold text-[var(--text)]">Find our campus</h2>
              <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{address}</p>
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text)]"
              >
                Get directions <ArrowRight size={13} aria-hidden="true" />
              </a>
            </section>

            <section className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5">
              <h2 className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]">
                <ShieldCheck size={15} aria-hidden="true" className="text-[var(--primary)]" />{" "}
                Before you contact us
              </h2>
              <p className="mt-2 text-[10px] leading-4 text-[var(--text-muted)]">
                For certificate issues, mention the student’s registered name and passing session.
                Do not send passwords or full identity-document numbers through email.
              </p>
            </section>
          </aside>
        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 px-1 text-[10px] text-[var(--text-muted)]">
          <nav aria-label="Related links" className="flex gap-4">
            <Link href="/privacy" className="hover:text-[var(--primary)]">
              Privacy policy
            </Link>
            <Link href="/faq" className="hover:text-[var(--primary)]">
              FAQ
            </Link>
            <Link href="/certificates" className="hover:text-[var(--primary)]">
              Certificates
            </Link>
          </nav>
        </footer>
      </div>
    </SiteShell>
  );
}
