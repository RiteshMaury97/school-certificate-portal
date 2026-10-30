"use client";
import { Link } from "react-router-dom";

import SiteShell from "@/src/components/SiteShell";
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
  return (
    <SiteShell>
      <section className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--accent)]">
          Satyam International School
        </p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--text)]">{page.title}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">{page.description}</p>
        {kind === "report" && (
          <Link
            to="/contact"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-contrast)]"
          >
            Contact the school
          </Link>
        )}
        {kind === "rights" && (
          <Link
            to="/contact"
            className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--primary-contrast)]"
          >
            Submit a request
          </Link>
        )}
        <div className="mt-8 flex flex-wrap gap-4">
          {page.links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm font-semibold text-[var(--primary)] underline"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
