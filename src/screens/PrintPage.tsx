"use client";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import type { StudentResult } from "@/src/types";
export default function PrintPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const result = (location.state as { result?: StudentResult } | null)?.result;
  useEffect(() => {
    if (!result?.accessToken) navigate("/certificates", { replace: true });
  }, [navigate, result]);
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (meta) meta.content = "noindex, nofollow, noarchive";
  }, []);
  if (!result?.accessToken) return null;
  return (
    <main className="mx-auto max-w-4xl p-6 print:p-0 notranslate" translate="no">
      <div className="mb-6 flex justify-between print:hidden">
        <Link to="/certificates/results" state={{ result }}>
          ← Back to results
        </Link>
        <button
          onClick={() => { window.print(); }}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-[var(--primary-contrast)]"
        >
          Print
        </button>
      </div>
      <header className="border-b-2 border-[var(--primary)] pb-5 text-center">
        <h1 className="text-2xl font-bold notranslate" translate="no">
          Satyam International School
        </h1>
        <p className="mt-1 text-sm">Certificate record summary</p>
      </header>
      <h2 className="mt-6 text-xl font-bold">Certificates found</h2>
      <p className="mt-2">
        <span className="notranslate" translate="no">
          {result.studentName}
        </span>
      </p>
      <div className="mt-5 space-y-4">
        {result.certificates.map((item) => (
          <article
            key={item.certId}
            className="break-inside-avoid rounded-lg border border-slate-300 p-4"
          >
            <strong>{item.type}</strong>
            <p>Session: {item.session}</p>
            <p>Certificate number: {item.certificateNumber}</p>
            <p>Issue date: {item.issueDate}</p>
          </article>
        ))}
      </div>
      <footer className="mt-10 border-t pt-3 text-center text-xs text-slate-500">
        Verified copy - Satyam International School
      </footer>
    </main>
  );
}
