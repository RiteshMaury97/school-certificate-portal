"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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
        <Link href="/certificates/results">← Back to results</Link>
        <button
          onClick={() => {
            window.print();
          }}
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
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-[var(--text-muted)]">Student name</dt>
          <dd>{result.studentName}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--text-muted)]">Father name</dt>
          <dd>{result.fatherName}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--text-muted)]">Mother name</dt>
          <dd>{result.motherName}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--text-muted)]">Class / section</dt>
          <dd>{result.className}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--text-muted)]">Scholar number</dt>
          <dd>{result.scholarNumber}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--text-muted)]">Passing session</dt>
          <dd>{result.session}</dd>
        </div>
      </dl>
      <h3 className="mt-6 text-lg font-bold">Certificates</h3>
      <table className="mt-3 w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {["Certificate", "Session", "Certificate number", "Issue date"].map((heading) => (
              <th key={heading} className="border border-[var(--border)] p-2">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.certificates.map((item) => (
            <tr key={item.certId} className="break-inside-avoid">
              <th scope="row" className="border border-[var(--border)] p-2">
                {item.type}
              </th>
              <td className="border border-[var(--border)] p-2">{item.session}</td>
              <td className="border border-[var(--border)] p-2">{item.certificateNumber}</td>
              <td className="border border-[var(--border)] p-2">
                {item.issueDate ?? "Not specified"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer className="mt-10 border-t pt-3 text-center text-xs text-[var(--text-muted)]">
        Verified copy - Satyam International School
      </footer>
    </main>
  );
}
