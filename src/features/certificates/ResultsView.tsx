"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SiteShell from "@/components/layout/SiteShell";
import { useCertificateFlow } from "@/features/certificates/CertificateFlowProvider";
export default function ResultsPage() {
  const router = useRouter();
  const { result } = useCertificateFlow();
  useEffect(() => {
    // A refresh or a direct visit has no in-memory result, so return to the finder.
    if (!result?.accessToken || !Array.isArray(result.certificates))
      router.replace("/certificates");
  }, [router, result]);
  if (!result?.accessToken) return null;
  return (
    <SiteShell>
      <section className="mx-auto max-w-5xl notranslate" translate="no">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/certificates" className="text-sm font-semibold text-[var(--text)]">
              ← Back
            </Link>
            <h1 className="mt-3 text-3xl font-bold text-[var(--text)]">Certificates found</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              <span className="notranslate" translate="no">
                {result.studentName}
              </span>
            </p>
          </div>
          <Link
            href="/certificates/print"
            className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-4 font-semibold"
          >
            Print view
          </Link>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.certificates.map((certificate) => (
            <article
              key={certificate.certId}
              className="rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm"
            >
              <h2 className="font-bold text-[var(--text)]">{certificate.type}</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Session</dt>
                  <dd>{certificate.session}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Certificate number</dt>
                  <dd>{certificate.certificateNumber}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">Issue date</dt>
                  <dd>{certificate.issueDate}</dd>
                </div>
              </dl>
              <a
                className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)]"
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
