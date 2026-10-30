"use client";
import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import SiteShell from "@/src/components/SiteShell";

import type { StudentResult } from "@/src/types";
export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const result = (location.state as { result?: StudentResult } | null)?.result;
  useEffect(() => {
    if (!result?.accessToken || !Array.isArray(result.certificates))
      navigate("/certificates", { replace: true });
  }, [navigate, result]);
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (meta) meta.content = "noindex, nofollow, noarchive";
    return () => {
      if (meta) meta.content = "index, follow";
    };
  }, []);
  if (!result?.accessToken) return null;
  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl notranslate" translate="no">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/certificates" className="text-sm font-semibold text-[var(--primary)]">
              ← Back
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-[var(--text)]">Certificates found</h1>
            <p className="mt-2 text-sm text-slate-600">
              <span className="notranslate" translate="no">
                {result.studentName}
              </span>
            </p>
          </div>
          <Link
            to="/certificates/print"
            state={{ result }}
            className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-semibold"
          >
            Print view
          </Link>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.certificates.map((certificate) => (
            <article
              key={certificate.certId}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="font-bold text-[var(--text)]">{certificate.type}</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Session</dt>
                  <dd>{certificate.session}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Certificate number</dt>
                  <dd>{certificate.certificateNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Issue date</dt>
                  <dd>{certificate.issueDate}</dd>
                </div>
              </dl>
              <a
                className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)]"
                href={`/api/certificates/${encodeURIComponent(certificate.certId)}/file?token=${encodeURIComponent(result.accessToken)}`}
              >
                Download
              </a>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
