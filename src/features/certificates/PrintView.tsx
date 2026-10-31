"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCertificateFlow } from "@/features/certificates/CertificateFlowProvider";
export default function PrintPage() {
  const router = useRouter();
  const { result } = useCertificateFlow();
  useEffect(() => {
    if (!result?.accessToken) router.replace("/certificates");
  }, [router, result]);
  if (!result?.accessToken) return null;
  return (
    <main className="mx-auto max-w-4xl p-6 print:p-0 notranslate" translate="no">
      <div className="mb-6 flex justify-between print:hidden">
        <Link href="/certificates/results">
          ← Back to results
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-[var(--on-primary)]"
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
            className="break-inside-avoid rounded-lg border border-[var(--border)] p-4"
          >
            <strong>{item.type}</strong>
            <p>Session: {item.session}</p>
            <p>Certificate number: {item.certificateNumber}</p>
            <p>Issue date: {item.issueDate}</p>
          </article>
        ))}
      </div>
      <footer className="mt-10 border-t pt-3 text-center text-xs text-[var(--text-muted)]">
        Verified copy - Satyam International School
      </footer>
    </main>
  );
}
