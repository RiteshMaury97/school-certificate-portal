"use client";

import Link from "next/link";

import { SCHOOL_INFO } from "@/lib/school-info";
import { usePublicSiteSettings } from "@/lib/use-site-settings";

export default function PageFooter() {
  const email = usePublicSiteSettings().email?.trim() ?? "";
  return (
    <footer className="mx-auto w-full max-w-[440px] px-5 pb-5 pt-4 text-center text-xs text-[var(--text-muted)] sm:px-8 lg:px-0">
      {email ? (
        <p>
          Need help? Contact{" "}
          <a
            className="font-medium text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            href={`mailto:${email}`}
          >
            {email}
          </a>
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-[var(--divider)] pt-3 text-[11px]">
        <span>© 2026 {SCHOOL_INFO.name}. All rights reserved.</span>
        <span aria-hidden="true">·</span>
        <nav aria-label="Legal links" className="flex gap-3">
          <Link
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            href="/privacy"
          >
            Privacy Policy
          </Link>
          <Link
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            href="/terms"
          >
            Terms &amp; Conditions
          </Link>
        </nav>
      </div>
    </footer>
  );
}
