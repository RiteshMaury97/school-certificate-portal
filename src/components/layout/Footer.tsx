"use client";

import {
  ArrowLeftRight,
  Clock,
  AtSign,
  Camera,
  CirclePlay,
  HeartPulse,
  Languages,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useT } from "@/i18n/locale-provider";


import Logo from "@/components/ui/Logo";
import { SITE_MAP } from "@/shared/site-map";

import {
  ADDRESS,
  AFFILIATION,
  BOARD,
  CAMPUS_SIZE,
  EMAIL,
  HOURS,
  HIGHLIGHTS,
  MANAGED_BY,
  OFFICIAL_WEBSITE,
  PHONE,
  SCHOOL_NAME,
  SCHOOL_SUBTITLE,
  SOCIAL_URLS,
  TAGLINE,
} from "../../../config/school";

import type { SiteMapPage } from "@/shared/site-map";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const cardClass =
  "flex h-full min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition-colors duration-200 hover:bg-white/[0.055]";
const highlightIcons = [HeartPulse, ArrowLeftRight, Languages] as const;

function ContactRow({
  icon: Icon,
  label,
  children,
  className = "text-xs",
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 leading-5 text-[var(--text-muted)] ${className}`}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-white/70" />
      <div className="min-w-0">
        <span className="mr-1 font-semibold text-white/80">{label}:</span>
        {children}
      </div>
    </div>
  );
}

function FooterNavigation({
  title,
  ariaLabel,
  pages,
}: {
  title: string;
  ariaLabel: string;
  pages: readonly SiteMapPage[];
}) {
  const t = useT();
  return (
    <nav aria-label={ariaLabel} className={cardClass}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">{title}</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {pages.map((page) => (
          <li key={page.path}>
            <Link
              href={page.path}
              className="inline-flex py-0.5 text-[var(--text-muted)] transition-colors hover:text-white focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {t(page.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SocialCard() {
  const socialLinks = [
    { label: "Facebook", url: SOCIAL_URLS.facebook, Icon: Users },
    { label: "Instagram", url: SOCIAL_URLS.instagram, Icon: Camera },
    { label: "YouTube", url: SOCIAL_URLS.youtube, Icon: CirclePlay },
    { label: "WhatsApp", url: SOCIAL_URLS.whatsapp, Icon: MessageCircle },
    { label: "X / Twitter", url: SOCIAL_URLS.twitter, Icon: AtSign },
  ];
  const hasConfiguredLinks = socialLinks.some(({ url }) => url.trim().length > 0);
  const visibleLinks = hasConfiguredLinks
    ? socialLinks.filter(({ url }) => url.trim().length > 0)
    : socialLinks;

  return (
    <nav aria-label="Follow us on social media" className={cardClass}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Follow us</h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {visibleLinks.map(({ label, url, Icon }) => (
          <li key={label}>
            <a
              href={url.trim() || "#"}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
              className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-[var(--text-muted)] transition duration-200 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Icon aria-hidden="true" className="size-4" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function SchoolLinks() {
  return SITE_MAP.filter((page) => ["/", "/certificates", "/verify"].includes(page.path));
}

function HelpLinks() {
  return SITE_MAP.filter(
    (page) => page.group === "Help and support" && page.path !== "/contact" && page.inHtmlSitemap,
  );
}

function LegalLinks() {
  return SITE_MAP.filter((page) => page.group === "Legal and privacy" && page.inHtmlSitemap);
}

function FooterLinkGrid() {
  return (
    <>
      <FooterNavigation title={"Quick links"} ariaLabel={"Quick links"} pages={SchoolLinks()} />
      <FooterNavigation title={"Help and support"} ariaLabel={"Help and support"} pages={HelpLinks()} />
      <FooterNavigation title={"Legal and privacy"} ariaLabel={"Legal and privacy"} pages={LegalLinks()} />
      <SocialCard />
    </>
  );
}

export default function Footer() {
  const t = useT();
  const boardDetails = [AFFILIATION, BOARD].filter((value) => value.trim()).join(" · ");
  const validPhone = !PHONE.includes("X");

  return (
    <footer className="public-footer relative mx-2 my-2 overflow-hidden rounded-3xl border border-[var(--border)] text-[var(--text)] shadow-xl">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
      />
      <div className="relative grid grid-cols-1 items-stretch gap-4 px-5 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-10 xl:px-14">
        {/* Row 1: school identity and details */}
        <section aria-label="School" className={`${cardClass} bg-white/[0.055]`}>
          <div className="flex items-center gap-3">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/15 bg-white/[0.08]">
              <Logo size={42} className="size-11 rounded-full bg-white object-contain p-0.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold uppercase tracking-[0.08em] text-white">
                {SCHOOL_NAME}
              </h2>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-white/55">
                {SCHOOL_SUBTITLE}
              </p>
            </div>
          </div>
          <p className="mt-4 line-clamp-2 break-words text-sm leading-5 text-[var(--text-muted)]">
            {TAGLINE}
          </p>
        </section>

        <section aria-label="School details" className={cardClass}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
            School details
          </h2>
          <div className="mt-3 space-y-2">
            <address className="not-italic">
              <ContactRow icon={MapPin} label="Address">
                {ADDRESS}
              </ContactRow>
            </address>
            <p className="text-xs leading-5 text-[var(--text-muted)]">
              <span className="font-semibold text-white/80">Managed by:</span> {MANAGED_BY}
            </p>
            <p className="text-xs leading-5 text-[var(--text-muted)]">
              <span className="font-semibold text-white/80">Campus:</span> {CAMPUS_SIZE}
            </p>
            {boardDetails && (
              <p className="text-xs leading-5 text-[var(--text-muted)]">
                <span className="font-semibold text-white/80">Affiliation / Board:</span>{" "}
                {boardDetails}
              </p>
            )}
          </div>
        </section>

        <section aria-label="School highlights" className={cardClass}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
            Highlights
          </h2>
          <ul className="mt-3 space-y-2">
            {HIGHLIGHTS.map((highlight, index) => {
              const Icon = highlightIcons[index] ?? HeartPulse;
              return (
                <li
                  key={highlight}
                  className="flex items-start gap-2.5 text-xs leading-5 text-[var(--text-muted)]"
                >
                  <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-white/70" />
                  <span>{highlight}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-label="Contact details" className={cardClass}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
            Contact
          </h2>
          <address className="mt-3 space-y-2 not-italic">
            <ContactRow icon={Phone} label="Phone">
              {validPhone ? <a href={`tel:${PHONE.replace(/[^\d+]/g, "")}`}>{PHONE}</a> : PHONE}
            </ContactRow>
            <ContactRow icon={Mail} label="Email">
              <a className="break-all" href={`mailto:${EMAIL}`}>
                {EMAIL}
              </a>
            </ContactRow>
            <ContactRow icon={Clock} label="Office hours" className="text-sm">
              {HOURS}
            </ContactRow>
            <ContactRow icon={MapPin} label="Official website">
              <a
                href={OFFICIAL_WEBSITE}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all"
              >
                {OFFICIAL_WEBSITE.replace(/^https?:\/\//i, "")}
              </a>
            </ContactRow>
          </address>
          <Link
            href="/contact"
            className="mt-auto pt-4 text-sm font-medium text-white/80 transition-colors hover:text-white focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Contact us <span aria-hidden="true">→</span>
          </Link>
        </section>

        {/* Row 2: navigation and social links */}
        <FooterLinkGrid />
      </div>
      <div className="border-t border-[var(--border)] bg-[var(--surface)]/70 px-5 py-4 sm:px-8 lg:px-10 xl:px-14">
        <div className="flex flex-col gap-2 text-[10px] text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 {SCHOOL_NAME}. All rights reserved.</span>
          <span className="font-medium text-white">Official student services</span>
        </div>
      </div>
    </footer>
  );
}
