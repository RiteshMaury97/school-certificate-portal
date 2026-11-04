"use client";

import { ArrowLeft, ArrowUpRight, BadgeCheck, CalendarDays, Download, FileBadge2, Printer, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import SiteShell from "@/components/layout/SiteShell";
import { useCertificateFlow } from "@/features/certificates/CertificateFlowProvider";
import FeedbackWidget from "@/features/feedback/FeedbackWidget";

export default function ResultsPage() {
  const router = useRouter();
  const { result } = useCertificateFlow();
  useEffect(() => {
    if (!result?.accessToken || !Array.isArray(result.certificates)) router.replace("/certificates");
  }, [router, result]);
  if (!result?.accessToken) return null;

  return (
    <SiteShell>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 notranslate" translate="no">
        <Link href="/certificates" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--text-muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--text)]">
          <ArrowLeft size={16} aria-hidden="true" /> Back to certificate search
        </Link>

        <section className="mt-5 overflow-hidden rounded-3xl border border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
          <div className="relative overflow-hidden bg-[var(--primary)] px-6 py-7 text-[var(--on-primary)] sm:px-9 sm:py-9">
            <div className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full border-[36px] border-white/5" />
            <div className="relative flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-white/75"><BadgeCheck size={15} /> Verified student records</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Certificates found</h1>
                <p className="mt-2 text-base text-white/85">{result.certificates.length} {result.certificates.length === 1 ? "certificate is" : "certificates are"} available for <span className="font-semibold text-white">{result.studentName}</span>.</p>
              </div>
              <Link href="/certificates/print" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"><Printer size={16} /> Print summary</Link>
            </div>
            <div className="relative mt-6 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-5 text-sm">
              <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-white/65">Class / section</span><span className="mt-1 block font-semibold">{result.className || "—"}</span></div>
              <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-white/65">Academic session</span><span className="mt-1 block font-semibold">{result.session || "—"}</span></div>
              <div><span className="block text-[10px] font-semibold uppercase tracking-wider text-white/65">Available records</span><span className="mt-1 block font-semibold">{result.certificates.length}</span></div>
            </div>
          </div>

          <div className="p-5 sm:p-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div><h2 className="text-lg font-bold text-[var(--text)]">Your certificates</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Choose a record to download its secure copy.</p></div>
              <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)]">{result.certificates.length} {result.certificates.length === 1 ? "record" : "records"}</span>
            </div>
            {result.certificates.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--divider)] px-5 py-12 text-center"><FileBadge2 className="mx-auto text-[var(--text-muted)]" /><h3 className="mt-3 font-semibold text-[var(--text)]">No certificates available</h3><p className="mt-1 text-sm text-[var(--text-muted)]">There are no published certificates for this student and session yet.</p></div> :
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {result.certificates.map((certificate, index) => (
                  <article key={certificate.certId} className="group flex min-h-64 flex-col rounded-2xl border border-[var(--divider)] bg-[var(--surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--primary)]/50 hover:shadow-lg">
                    <div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--primary)]"><FileBadge2 size={22} /></span><span className="rounded-full border border-[var(--divider)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-muted)]">Record {String(index + 1).padStart(2, "0")}</span></div>
                    <h3 className="mt-4 text-lg font-bold leading-snug text-[var(--text)]">{certificate.title || certificate.type}</h3>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">Official school certificate</p>
                    <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                      <div><dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]"><CalendarDays size={12} /> Session</dt><dd className="mt-1 font-semibold text-[var(--text)]">{certificate.session}</dd></div>
                      <div><dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Issue date</dt><dd className="mt-1 font-semibold text-[var(--text)]">{certificate.issueDate.length ? certificate.issueDate : "Not specified"}</dd></div>
                      <div className="col-span-2"><dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Certificate number</dt><dd className="mt-1 break-all font-semibold text-[var(--text)]">{certificate.certificateNumber || "Not specified"}</dd></div>
                    </dl>
                    <a className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--on-primary)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]" href={`/api/certificates/${encodeURIComponent(certificate.certId)}/file?token=${encodeURIComponent(result.accessToken)}`}><Download size={16} /> Download certificate <ArrowUpRight size={15} className="ml-auto" /></a>
                  </article>
                ))}
              </div>
            }
            <div className="mt-6 flex items-start gap-3 rounded-xl bg-[var(--surface-2)] p-4"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--primary)]" /><p className="text-xs leading-5 text-[var(--text-muted)]">This private page is tied to your verified search and expires shortly. Downloaded files include a light watermark for record security.</p></div>
          </div>
        </section>
        <FeedbackWidget />
      </main>
    </SiteShell>
  );
}
