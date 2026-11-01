"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import SiteShell from "@/components/layout/SiteShell";
import { useCertificateFlow } from "@/features/certificates/CertificateFlowProvider";

const downloadUrl = (certId: string, token: string) =>
  `/api/certificates/${encodeURIComponent(certId)}/file?token=${encodeURIComponent(token)}`;

export default function ResultsPage() {
  const router = useRouter();
  const { result } = useCertificateFlow();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");
  useEffect(() => {
    if (!result?.accessToken || !Array.isArray(result.certificates))
      router.replace("/certificates");
  }, [router, result]);
  if (!result?.accessToken) return null;
  const accessToken = result.accessToken;
  async function downloadCertificate(certId: string, certificateName: string) {
    if (downloadingId) return;
    setDownloadingId(certId);
    setDownloadError("");
    try {
      const response = await fetch(downloadUrl(certId, accessToken), { cache: "no-store" });
      if (!response.ok)
        throw new Error("Certificate could not be downloaded. Search again and retry.");
      const file = await response.blob();
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${certificateName.replace(/[^\p{L}\p{N}-]+/gu, "-") || "certificate"}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Certificate download failed. Retry.",
      );
    } finally {
      setDownloadingId(null);
    }
  }
  const details = [
    ["Student name", result.studentName],
    ["Father name", result.fatherName],
    ["Mother name", result.motherName],
    ["Class / section", result.className],
    ["Scholar number", result.scholarNumber],
    ["Passing session", result.session],
  ].filter(([, value]) => Boolean(value));

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
              Verified student record and available certificates.
            </p>
          </div>
          <Link
            href="/certificates/print"
            className="inline-flex min-h-11 items-center rounded-lg border border-[var(--border)] px-4 font-semibold"
          >
            Print view
          </Link>
        </div>

        <section
          aria-labelledby="student-details-title"
          className="mt-6 rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm"
        >
          <h2 id="student-details-title" className="text-base font-bold text-[var(--text)]">
            Student details
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {details.map(([label, value]) => (
              <div key={label} className="rounded-lg bg-[var(--surface-2)] p-3">
                <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-[var(--text)]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          aria-labelledby="certificate-list-title"
          className="mt-6 overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)] shadow-sm"
        >
          <div className="border-b border-[var(--divider)] p-5">
            <h2 id="certificate-list-title" className="text-base font-bold text-[var(--text)]">
              Certificates
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {result.certificates.length} certificate{result.certificates.length === 1 ? "" : "s"}{" "}
              available. Download each document from its row.
            </p>
          </div>
          {downloadError && (
            <p
              role="alert"
              className="border-b border-[var(--divider)] bg-[var(--surface-2)] px-5 py-3 text-sm text-[var(--danger)]"
            >
              {downloadError}
            </p>
          )}
          {result.certificates.length === 0 ? (
            <p className="p-5 text-sm text-[var(--text-muted)]">
              No published certificates are available.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[var(--surface-2)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    <th scope="col" className="px-5 py-3">
                      Certificate
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Session
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Certificate number
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Issue date
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Document
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.certificates.map((certificate) => (
                    <tr key={certificate.certId} className="border-t border-[var(--divider)]">
                      <th scope="row" className="px-5 py-4 font-semibold text-[var(--text)]">
                        {certificate.type}
                      </th>
                      <td className="px-5 py-4">{certificate.session}</td>
                      <td className="px-5 py-4">{certificate.certificateNumber}</td>
                      <td className="px-5 py-4">{certificate.issueDate ?? "Not specified"}</td>
                      <td className="px-5 py-4">
                        <button
                          type="button"
                          disabled={downloadingId !== null}
                          onClick={() =>
                            void downloadCertificate(certificate.certId, certificate.type)
                          }
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--on-primary)] disabled:cursor-wait disabled:opacity-65"
                        >
                          {downloadingId === certificate.certId && (
                            <span
                              aria-hidden="true"
                              className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--on-primary)]/35 border-t-[var(--on-primary)]"
                            />
                          )}
                          {downloadingId === certificate.certId
                            ? "Preparing download…"
                            : `Download ${certificate.type}`}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </SiteShell>
  );
}
