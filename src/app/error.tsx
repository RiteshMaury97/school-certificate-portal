"use client";
import Link from "next/link";
import { useEffect } from "react";

import Logo from "@/components/ui/Logo";
import { useT } from "@/i18n/locale-provider";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error("Route rendering failed", error.digest ?? "");
  }, [error]);
  return (
    <main id="main-content" tabIndex={-1} className="error-page">
      <Logo size={72} className="rounded-xl bg-white p-1 object-contain" />
      <p className="error-code">500</p>
      <h1>{t("errors.notFoundTitle")}</h1>
      <p>{t("errors.unexpected")}</p>
      <button type="button" onClick={() => { reset(); }}>
        {t("errors.tryAgain")}
      </button>
      <Link href="/">{t("errors.goHome")}</Link>
    </main>
  );
}
