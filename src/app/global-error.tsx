"use client";
import { useEffect, useState } from "react";
import "@/styles/globals.css";
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [support, setSupport] = useState<{
    schoolName?: string;
    email?: string;
    phone?: string;
  }>({});
  useEffect(() => {
    document.title = "Service error";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    fetch("/api/public/site-settings", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setSupport(data.settings ?? {}))
      .catch(() => undefined);
    return () => meta.remove();
  }, []);
  return (
    <html lang="en">
      <body>
        <main id="main-content" tabIndex={-1} className="error-page">
          <p className="error-code">500</p>
          <h1>Something went wrong</h1>
          <p>We could not complete that request. Please try again.</p>
          <button onClick={() => reset()}>Try again</button>
          <a href="/">Return to home</a>
          <p className="error-support">
            {support.schoolName?.trim() || "School"} support:{" "}
            {support.email?.trim() ? (
              <a href={`mailto:${support.email.trim()}`}>{support.email.trim()}</a>
            ) : null}{" "}
            {support.phone?.trim() ? (
              <a href={`tel:${support.phone.trim()}`}>{support.phone.trim()}</a>
            ) : null}
          </p>
        </main>
      </body>
    </html>
  );
}
