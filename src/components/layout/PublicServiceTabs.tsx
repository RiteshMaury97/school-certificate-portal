"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function PublicServiceTabs() {
  const pathname = usePathname();
  const verify = pathname === "/verify";
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]";
  return (
    <nav
      aria-label="Certificate services"
      className="mb-6 flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2"
    >
      <Link
        href="/certificates"
        aria-current={!verify ? "page" : undefined}
        className={`${base} ${!verify ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"}`}
      >
        Find My Certificates
      </Link>
      <Link
        href="/verify"
        aria-current={verify ? "page" : undefined}
        className={`${base} ${verify ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"}`}
      >
        Verify a Certificate
      </Link>
    </nav>
  );
}
