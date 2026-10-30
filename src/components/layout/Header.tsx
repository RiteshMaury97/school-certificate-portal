"use client";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, X, ShieldCheck } from "lucide-react";
import IconButton from "@/src/components/ui/IconButton";
import LanguageButton from "@/src/features/translate/LanguageButton";
import ThemeToggle from "@/src/features/theme/ThemeToggle";
import ContrastToggle from "@/src/features/theme/ContrastToggle";
type Props = { schoolName?: string; logoUrl?: string; includedLanguages?: string };
const links = [
  { label: "Home", to: "/" },
  { label: "Certificates", to: "/certificates" },
  { label: "Verify", to: "/verify" },
  { label: "FAQ", to: "/faq" },
  { label: "Contact", to: "/contact" },
];
function Utilities({ includedLanguages }: { includedLanguages?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <LanguageButton includedLanguages={includedLanguages} />
      <ThemeToggle />
      <ContrastToggle />
      <Link
        to="/admin/login"
        aria-label="Administrator sign in"
        title="Administrator sign in"
        data-tooltip="Administrator sign in"
        className="group relative inline-grid h-11 w-11 min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
      >
        <ShieldCheck size={19} aria-hidden="true" />
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-[70] hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--text)] px-2 py-1 text-xs font-medium text-[var(--surface)] shadow-lg group-hover:block group-focus-visible:block"
        >
          Administrator sign in
        </span>
      </Link>
    </div>
  );
}
export default function Header({
  schoolName = "Satyam International School",
  logoUrl,
  includedLanguages,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-3 px-3 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="flex min-w-0 shrink items-center gap-2.5 rounded-lg text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg bg-[var(--surface-2)] object-contain"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--primary)] text-xs font-bold text-[var(--primary-contrast)]"
              >
                SIS
              </span>
            )}
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
          <nav aria-label="Main navigation" className="ml-5 hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                end={link.to === "/"}
                to={link.to}
                className={({ isActive }) =>
                  `relative inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition-colors ${isActive ? "text-[var(--primary)] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto hidden lg:block">
            <Utilities includedLanguages={includedLanguages} />
          </div>
          <div className="ml-auto lg:hidden">
            <IconButton
              label={open ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={open}
              aria-controls="mobile-navigation-drawer"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X size={21} /> : <Menu size={21} />}
            </IconButton>
          </div>
        </div>
      </header>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/45 lg:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <aside
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            className="ml-auto flex h-dvh w-[min(88vw,22rem)] flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="font-bold text-[var(--text)]">Menu</span>
              <IconButton label="Close navigation menu" onClick={() => setOpen(false)}>
                <X size={20} />
              </IconButton>
            </div>
            <nav aria-label="Mobile main navigation" className="grid gap-1">
              {links.map((link) => (
                <NavLink
                  key={link.to}
                  end={link.to === "/"}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center rounded-xl px-3 text-base font-semibold ${isActive ? "bg-[var(--surface-2)] text-[var(--primary)]" : "text-[var(--text)] hover:bg-[var(--surface-2)]"}`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-6 border-t border-[var(--border)] pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Preferences
              </p>
              <Utilities includedLanguages={includedLanguages} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
