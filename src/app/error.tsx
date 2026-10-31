"use client";
import { useEffect } from "react";

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
      <p className="error-code">500</p>
      <h1>This page could not be loaded</h1>
      <p>Something went wrong while preparing this page. Please try again.</p>
      <button type="button" onClick={() => { reset(); }}>
        Try again
      </button>
      <a href="/">Return to home</a>
    </main>
  );
}
