"use client";

import Link from "next/link";

import Logo from "@/components/ui/Logo";
import { useT } from "@/i18n/locale-provider";

export default function NotFound() {
  const t = useT();
  return (
    <main id="main-content" tabIndex={-1} className="error-page">
      <Logo size={72} className="mx-auto rounded-xl bg-white p-1 object-contain" />
      <p className="error-code">404</p>
      <h1>{t("errors.notFoundTitle")}</h1>
      <p>{t("errors.notFoundDescription")}</p>
      <Link href="/">{t("errors.goHome")}</Link>
    </main>
  );
}
