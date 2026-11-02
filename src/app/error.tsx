"use client";
import Link from "next/link";
import { useEffect } from "react";

import Logo from "@/components/ui/Logo";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route rendering failed", error.digest ?? "");
  }, [error]);
  return (
    <main id="main-content" tabIndex={-1} className="error-page">
      <Logo size={72} className="rounded-xl bg-white p-1 object-contain" />
      <p className="error-code">500</p>
      <h1>This page could not be loaded</h1>
      <p>Something went wrong while preparing this page. Please try again.</p>
      <button type="button" onClick={() => { reset(); }}>
        Try again
      </button>
      <Link href="/">Return to home</Link>
    </main>
  );
}
