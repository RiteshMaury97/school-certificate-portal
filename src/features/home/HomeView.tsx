"use client";

import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  FileCheck2,
  Globe,
  HelpCircle,
  LockKeyhole,
  MapPin,
  SearchCheck,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import SiteShell from "@/components/layout/SiteShell";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useT } from "@/i18n/locale-provider";
import { usePublicSiteSettings } from "@/lib/use-site-settings";

import { OFFICIAL_WEBSITE } from "../../../config/school";

const services = [
  {
    number: "01",
    icon: FileCheck2,
    title: "Find my certificates",
    description: "Look up certificates available for your student record.",
    href: "/certificates",
    action: "Find a certificate",
  },
  {
    number: "02",
    icon: SearchCheck,
    title: "Verify a certificate",
    description: "Check a certificate issued by the school using its verification details.",
    href: "/verify",
    action: "Verify a record",
  },
  {
    number: "03",
    icon: HelpCircle,
    title: "Help & FAQs",
    description: "Get answers about student records, certificates and support.",
    href: "/faq",
    action: "Visit help centre",
  },
];

const steps = [
  ["Enter your details", "Use the same student details recorded by the school."],
  ["Complete verification", "A security check helps protect student records."],
  ["View available records", "Review and download certificates available to you."],
] as const;

function settingOr(value: string | undefined, fallback: string): string {
  const cleanValue = value?.trim();
  return cleanValue && cleanValue.length > 0 ? cleanValue : fallback;
}

export default function HomePage() {
  const settings = usePublicSiteSettings();
  const t = useT();
  const schoolName = settingOr(settings.schoolName, "Satyam International School");
  const address = settingOr(settings.address, "Lodipur, Zamania, Ghazipur, Uttar Pradesh 232329");
  const phone = settingOr(settings.phone, "+91 9336950476");
  const email = settingOr(settings.email, "");
  const website = OFFICIAL_WEBSITE;

  return (
    <SiteShell>
      <Breadcrumb className="mb-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">{t("nav.home")}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{t("home.studentServices")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <section className="relative isolate overflow-hidden rounded-3xl bg-[var(--primary)] px-6 py-9 text-[var(--on-primary)] shadow-[var(--shadow-card)] sm:px-10 sm:py-12 lg:px-12 lg:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full border border-[color-mix(in_srgb,var(--on-primary)_15%,transparent)] sm:right-8 sm:top-1/2 sm:-translate-y-1/2"
        />
        <div className="relative grid items-center gap-9 sm:grid-cols-[minmax(0,1fr)_260px] lg:gap-14">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--on-primary)_25%,transparent)] bg-[color-mix(in_srgb,var(--on-primary)_8%,transparent)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]">
              <ShieldCheck size={13} aria-hidden="true" /> {t("home.officialPortal")}
            </p>
            <h1 className="mt-5 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {t("home.journey")}
              <br className="hidden sm:block" /> {t("home.trustedPlace")}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[color-mix(in_srgb,var(--on-primary)_82%,transparent)] sm:text-base sm:leading-7">
              {t("home.welcomeText").replace("{schoolName}", schoolName)}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/certificates"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--surface-2)]"
              >
                {t("home.findCertificates")} <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link
                href="/verify"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--on-primary)_45%,transparent)] px-4 text-sm font-semibold text-[var(--on-primary)] transition hover:bg-[color-mix(in_srgb,var(--on-primary)_10%,transparent)]"
              >
                {t("home.verifyCertificate")}
              </Link>
            </div>
            <p className="mt-4 flex items-center gap-2 text-[10px] text-[color-mix(in_srgb,var(--on-primary)_75%,transparent)]">
              <LockKeyhole size={12} aria-hidden="true" /> {t("home.secureRecords")}
            </p>
          </div>

          <aside className="rounded-2xl border border-[color-mix(in_srgb,var(--on-primary)_12%,transparent)] bg-[color-mix(in_srgb,var(--on-primary)_7%,transparent)] p-5">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--text)]">
              SIS
            </div>
            <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--on-primary)]">
              Learn · Grow · Excel
            </p>
            <div className="mt-5 rounded-xl bg-[var(--surface)] p-4 text-[var(--text)]">
              <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--primary)]">
                Student services
              </p>
              <div className="mt-2 flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--surface-2)] text-[var(--primary)]">
                  <BookOpenCheck size={16} aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold">Transfer certificate</p>
                  <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
                    Access official records
                  </p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-[10px] text-[color-mix(in_srgb,var(--on-primary)_75%,transparent)]">
              Official school information, always within reach.
            </p>
          </aside>
        </div>
      </section>

      <section aria-labelledby="services-title" className="mt-9 sm:mt-11">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
              Student services
            </p>
            <h2
              id="services-title"
              className="mt-1 text-xl font-semibold text-[var(--text)] sm:text-2xl"
            >
              How can we help?
            </h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {services.map(({ number, icon: Icon, title, description, href, action }) => (
            <Link
              key={number}
              href={href}
              className="group rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--primary)] hover:shadow-[var(--shadow-card)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]">
                <Icon size={17} aria-hidden="true" />
              </span>
              <p className="mt-4 text-[10px] font-semibold tracking-wide text-[var(--text-muted)]">
                {number}
              </p>
              <h3 className="mt-1 text-base font-semibold text-[var(--text)]">{title}</h3>
              <p className="mt-2 min-h-10 text-xs leading-5 text-[var(--text-muted)]">
                {description}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)]">
                {action}
                <ArrowRight
                  size={13}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-9 grid gap-5 sm:mt-11 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
                Simple and secure
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">How it works</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Three simple steps to access official school records.
              </p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]">
              <BadgeCheck size={18} aria-hidden="true" />
            </span>
          </div>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {steps.map(([title, description], index) => (
              <li key={title} className="rounded-xl bg-[var(--surface-2)] p-4">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--surface)] text-[10px] font-bold text-[var(--primary)]">
                  0{index + 1}
                </span>
                <h3 className="mt-3 text-xs font-semibold text-[var(--text)]">{title}</h3>
                <p className="mt-1.5 text-[10px] leading-4 text-[var(--text-muted)]">
                  {description}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <aside className="rounded-2xl bg-[var(--surface-2)] p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
            School information
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">Visit or contact us</h2>
          <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-[var(--text-muted)]">
            <MapPin
              size={15}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-[var(--primary)]"
            />
            {address}
          </p>
          <div className="mt-4 flex flex-col gap-2 text-xs">
            {phone && (
              <a
                className="font-semibold text-[var(--text)] hover:text-[var(--primary)]"
                href={`tel:${phone}`}
              >
                {phone}
              </a>
            )}
            {email && (
              <a
                className="break-all text-[var(--text)] hover:text-[var(--primary)]"
                href={`mailto:${email}`}
              >
                {email}
              </a>
            )}
            <a
              className="inline-flex items-center gap-1.5 break-all text-[var(--text)] hover:text-[var(--primary)]"
              href={website}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Globe size={13} aria-hidden="true" />
              Visit website
            </a>
          </div>
          <Link
            href="/contact"
            className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text)] hover:border-[var(--primary)]"
          >
            Contact the school <ArrowRight size={13} aria-hidden="true" />
          </Link>
        </aside>
      </section>
    </SiteShell>
  );
}
