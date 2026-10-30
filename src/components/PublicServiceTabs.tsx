"use client";
import { Link, useLocation } from "react-router-dom";

export default function PublicServiceTabs() {
  const location = useLocation();
  const verify = location.pathname === "/verify";
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]";
  return (
    <nav
      aria-label="Certificate services"
      className="mb-6 flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-white p-2"
    >
      <Link
        to="/"
        aria-current={!verify ? "page" : undefined}
        className={`${base} ${!verify ? "bg-[var(--primary)] text-[var(--primary-contrast)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"}`}
      >
        Find My Certificates
      </Link>
      <Link
        to="/verify"
        aria-current={verify ? "page" : undefined}
        className={`${base} ${verify ? "bg-[var(--primary)] text-[var(--primary-contrast)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"}`}
      >
        Verify a Certificate
      </Link>
    </nav>
  );
}
