export default function HelpPolicies() {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
      <h2 className="text-lg font-bold">Management and operational documents</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Read these controlled documents before approving production access, handling student
        information or responding to an incident. The Markdown files are published from the
        project’s <code>docs/</code> folder.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <a
          href="/docs/pentest-checklist.md"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border p-4 hover:bg-[var(--surface-2)]"
        >
          <b>Penetration Test Checklist</b>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Manual security tests, automated scans, findings and sign-off.
          </p>
        </a>
        <a
          href="/docs/privacy-impact-review.md"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border p-4 hover:bg-[var(--surface-2)]"
        >
          <b>Privacy Impact Review</b>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Personal data inventory, providers, access, retention, risks and DPDP checklist.
          </p>
        </a>
        <a
          href="/docs/disaster-recovery.md"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border p-4 hover:bg-[var(--surface-2)]"
        >
          <b>Disaster Recovery Plan</b>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Backup, recovery roles, restore steps, contacts and restore test log.
          </p>
        </a>
      </div>
      <p className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm text-[var(--text)]">
        Go-live requirement: complete the penetration test, approve the privacy review, fill all
        disaster-recovery role/contact and RTO/RPO placeholders, and record one successful staging
        restore test.
      </p>
    </section>
  );
}
