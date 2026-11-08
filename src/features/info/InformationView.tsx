"use client";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";

import SiteShell from "@/components/layout/SiteShell";
type Kind = "contact" | "report" | "rights" | "offline" | "maintenance";
const content: Record<
  Kind,
  { title: string; description: string; links: { label: string; href: string }[] }
> = {
  contact: {
    title: "Contact and support",
    description:
      "For help with certificate access, record matching or school services, contact the school office using the support details shown below.",
    links: [
      { label: "Find certificates", href: "/certificates" },
      { label: "Frequently asked questions", href: "/faq" },
    ],
  },
  report: {
    title: "Report a wrong record",
    description:
      "If a certificate or student record appears incorrect, submit a report with the relevant session and a clear description. Do not include unnecessary personal information.",
    links: [{ label: "Contact support", href: "/contact" }],
  },
  rights: {
    title: "Data protection and your rights",
    description:
      "You may request access to your personal data, correction of inaccurate information, erasure where applicable, or withdrawal of consent. Requests are reviewed in accordance with applicable data-protection requirements.",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Contact support", href: "/contact" },
    ],
  },
  offline: {
    title: "You are offline",
    description:
      "The school services are not currently reachable. Check your internet connection and try again.",
    links: [{ label: "Return home", href: "/" }],
  },
  maintenance: {
    title: "Service temporarily unavailable",
    description: "This service is undergoing scheduled maintenance. Please try again later.",
    links: [{ label: "Return home", href: "/" }],
  },
};
export default function InformationPage({ kind }: { kind: Kind }) {
  const page = content[kind];
  const localizedTitle = kind === "rights" ? "Data protection and your rights"
    : kind === "report" ? "Report a wrong record"
      : kind === "contact" ? "Contact the school" : page.title;
  if (kind === "rights") {
    return (
      <SiteShell>
        <section className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-[var(--text)]/5">
          <div aria-hidden="true" className="absolute -right-24 -top-28 -z-10 size-80 rounded-full bg-[var(--primary)]/10 blur-3xl" />
          <div className="grid lg:grid-cols-[1.45fr_0.75fr]">
            <div className="px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
              <div className="mb-8 inline-flex size-14 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <ShieldCheck size={28} aria-hidden="true" />
              </div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--primary)]">
                Satyam International School
              </p>
              <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-[var(--text)] sm:text-4xl lg:text-5xl">
                {localizedTitle}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg sm:leading-8">
                You may request access to your personal data, correction of inaccurate information,
                erasure where applicable, or withdrawal of consent. Requests are reviewed in
                accordance with applicable data-protection requirements.
              </p>
              <Link
                href="/contact"
                className="group mt-8 inline-flex min-h-12 items-center gap-3 rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-[var(--on-primary)] shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
              >
                Submit a request
                <ArrowRight size={17} aria-hidden="true" className="transition-transform group-hover:translate-x-1" />
              </Link>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 border-t border-[var(--border)] pt-6">
                {page.links.map((link) => (
                  <Link key={link.href} href={link.href} className="text-sm font-semibold text-[var(--text)]">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <aside className="flex flex-col justify-center bg-[var(--surface-2)] px-6 py-8 sm:px-10 lg:px-9">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--text-muted)]">What you can request</p>
              <ul className="mt-6 space-y-5">
                {["Access your personal data", "Correct inaccurate information", "Request erasure where applicable", "Withdraw consent"].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm font-medium leading-6 text-[var(--text)]">
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]"><Check size={14} aria-hidden="true" /></span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-8 border-t border-[var(--border)] pt-5 text-xs leading-5 text-[var(--text-muted)]">
                Our team will review your request and follow up if more information is needed.
              </p>
            </aside>
          </div>
        </section>
      </SiteShell>
    );
  }
  return (
    <SiteShell>
      <section className="mx-auto max-w-3xl rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-7 shadow-sm sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--text-muted)]">
          Satyam International School
        </p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--text)]">{localizedTitle}</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">{page.description}</p>
        {kind === "report" && (
          <Link
            href="/contact"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--on-primary)]"
          >
            Contact the school
          </Link>
        )}
        <div className="mt-8 flex flex-wrap gap-4">
          {page.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-[var(--text)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
