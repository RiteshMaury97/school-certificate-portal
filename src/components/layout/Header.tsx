"use client";
import { Menu, X, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import IconButton from "@/components/ui/IconButton";
import Logo from "@/components/ui/Logo";
import ThemeToggle from "@/features/theme/ThemeToggle";
import LanguageButton from "@/features/translate/LanguageButton";
import { useT } from "@/i18n/locale-provider";

type Props = {
  schoolName?: string | undefined;
};

const links = [
  { key: "nav.home", to: "/" },
  { key: "nav.certificates", to: "/certificates" },
  { key: "nav.verify", to: "/verify" },
  { key: "nav.faq", to: "/faq" },
  { key: "nav.contact", to: "/contact" },
];

function isActive(pathname: string, to: string): boolean {
  return to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(`${to}/`);
}

function Utilities() {
  const t = useT();
  return (
    <div className="flex items-center gap-1.5">
      <LanguageButton />
      <ThemeToggle />
      <Link
        href="/admin/login"
        aria-label={t("nav.adminSignIn")}
        title={t("nav.adminSignIn")}
        data-tooltip={t("nav.adminSignIn")}
        className="group relative inline-grid h-11 w-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
      >
        <ShieldCheck size={19} aria-hidden="true" />
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[70] hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--text)] px-2 py-1 text-xs font-medium text-[var(--surface)] shadow-lg group-hover:block group-focus-visible:block"
        >
          {t("nav.adminSignIn")}
        </span>
      </Link>
    </div>
  );
}

function MobileNavigation({
  open,
  pathname,
  onClose,
}: {
  open: boolean;
  pathname: string;
  onClose: () => void;
}) {
  const t = useT();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--scrim)] lg:hidden">
      <button
        type="button"
        aria-label={t("nav.closeMenu")}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default"
      />
      <aside
        id="mobile-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.mobileLabel")}
        className="relative ml-auto flex h-dvh w-full flex-col overflow-y-auto border-t-[3px] border-t-[var(--primary)] bg-[var(--surface)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:w-[min(88vw,22rem)] sm:border-l sm:border-t-0 sm:px-5 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="mb-5 flex min-h-11 items-center justify-between">
          <span className="font-bold text-[var(--text)]">{t("nav.menu")}</span>
          <IconButton label={t("nav.closeMenu")} onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <nav aria-label={t("nav.mainLabel")} className="grid gap-1">
          {links.map((link) => (
            <Link
              key={link.to}
              href={link.to}
              onClick={onClose}
              aria-current={isActive(pathname, link.to) ? "page" : undefined}
              className={`flex min-h-12 items-center rounded-[14px] px-3 text-[15px] font-semibold ${isActive(pathname, link.to) ? "bg-[var(--surface-2)] text-[var(--text)]" : "text-[var(--text)] hover:bg-[var(--surface-2)]"}`}
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>
        <div className="mt-6 border-t border-[var(--border)] pt-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t("nav.preferences")}
          </p>
          <Utilities />
        </div>
      </aside>
    </div>
  );
}

export default function Header({
  schoolName = "Satyam International School",
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useT();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex min-w-0 shrink items-center gap-2.5 rounded-lg text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
          >
            <Logo size={40} priority className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5 sm:h-10 sm:w-10" />
            <span
              className="notranslate hidden truncate text-[15px] font-bold tracking-tight min-[481px]:inline"
              translate="no"
            >
              {schoolName}
            </span>
            <span
              className="notranslate truncate text-[15px] font-bold tracking-tight min-[481px]:hidden"
              translate="no"
            >
              Satyam Intl. School
            </span>
          </Link>
          <nav aria-label={t("nav.mainLabel")} className="ml-5 hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <Link
                key={link.to}
                href={link.to}
                aria-current={isActive(pathname, link.to) ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${isActive(pathname, link.to) ? "text-[var(--text)] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--accent)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"}`}
              >
                {t(link.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto hidden lg:block">
            <Utilities />
          </div>
          <div className="ml-auto lg:hidden">
            <IconButton
              label={open ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={open}
              aria-controls="mobile-navigation-drawer"
              onClick={() => {
                setOpen((value) => !value);
              }}
            >
              {open ? <X size={21} /> : <Menu size={21} />}
            </IconButton>
          </div>
        </div>
      </header>
      <MobileNavigation
        open={open}
        pathname={pathname}
        onClose={() => {
          setOpen(false);
        }}
      />
    </>
  );
}
