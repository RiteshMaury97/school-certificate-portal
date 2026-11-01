"use client";
import { useState } from "react";

import { appCheckHeaders } from "@/lib/firebase-client";
import { usePublicSiteSettings } from "@/lib/use-site-settings";

import type { LegalSection } from "@/components/layout/LegalPageLayout";
import type { SubmitEvent} from "react";

import LegalPageLayout from "@/components/layout/LegalPageLayout";

const region = process.env.NEXT_PUBLIC_DATA_HOSTING_REGION || "{{HOSTING_REGION}}";
const version = process.env.NEXT_PUBLIC_PRIVACY_POLICY_VERSION || "2026-10";

export default function PrivacyPage() {
  const settings = usePublicSiteSettings();
  const school = settings.schoolName?.trim() || "Satyam International School";
  const address = settings.address?.trim() || "";
  const email = settings.email?.trim() || "";
  const officer = settings.grievanceOfficerName?.trim() || "";
  const officerEmail = settings.grievanceOfficerEmail?.trim() || "";
  const officerPhone = settings.grievanceOfficerPhone?.trim() || "";
  const updated = settings.lastUpdated?.trim() || "No data found";
  const retentionYears =
    settings.retentionYears ?? Number(process.env.NEXT_PUBLIC_RETENTION_YEARS || 7);
  const retentionText = `${retentionYears} years`;
  const backupRotationDays = settings.backupRotationDays ?? 30;
  const [requestType, setRequestType] = useState("access");
  const [requesterName, setRequesterName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [description, setDescription] = useState("");
  const [guardianConfirmation, setGuardianConfirmation] = useState(false);
  const [acknowledgment, setAcknowledgment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setAcknowledgment("");
    setBusy(true);
    try {
      const response = await fetch("/api/public/data-rights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await appCheckHeaders()),
        },
        body: JSON.stringify({
          requestType,
          requesterName,
          contactEmail,
          studentName,
          description,
          guardianConfirmation,
        }),
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to submit request.");
      setAcknowledgment(String(data.acknowledgmentId));
      setDescription("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit request.");
    } finally {
      setBusy(false);
    }
  }

  const sections: LegalSection[] = [
    {
      id: "fiduciary",
      title: "1. Who is responsible for your data?",
      content: (
        <>
          <p>
            {school} (“School”) is the Data Fiduciary for personal data processed through this
            portal. The School decides the purposes and means of processing and is responsible for
            handling requests and grievances.
          </p>
          <p>
            Postal address: {address}. General contact:{" "}
            <a className="font-semibold text-[var(--text)] underline" href={`mailto:${email}`}>
              {email}
            </a>
            .
          </p>
        </>
      ),
    },
    {
      id: "data",
      title: "2. Personal data we collect",
      content: (
        <>
          <p>
            For certificate retrieval, the portal collects the student’s name, father’s name,
            mother’s name, academic/passing session and the certificate file. Limited certificate
            metadata (such as certificate type, number and issue date) is used to identify and
            deliver the requested document.
          </p>
          <p>
            For security and administration, the system may also record consent version and
            timestamp, hashed network identifiers, request outcomes, administrator audit events and
            technical security data. Do not submit information that the form does not request.
          </p>
          <p>
            If you submit a wrong-record report, the School receives the name, passing session,
            issue description, contact detail and consent you provide. The portal assigns a
            reference ID and records ticket status, staff handling notes and a hashed network
            identifier for abuse prevention and audit purposes.
          </p>
          <p>
            If you use the optional “Was this helpful?” widget, the portal stores only your
            helpful/not-helpful choice, an optional comment of up to 200 characters, the submission
            timestamp and the page path. Do not enter personal details in the comment. A separate
            short-lived abuse counter uses a hashed network identifier to rate-limit submissions;
            that identifier is not added to the feedback record.
          </p>
        </>
      ),
    },
    {
      id: "purposes",
      title: "3. Purposes and legal basis",
      content: (
        <>
          <p>
            Student and certificate information is used to verify a certificate lookup, retrieve the
            matching school-issued document, maintain the accuracy and integrity of school
            certificate records, prevent abuse and meet applicable legal obligations. The portal is
            not used for advertising, behavioural profiling, unrelated marketing or student ranking.
          </p>
          <p>
            Where consent is required, the portal displays a plain-language notice and an unticked
            checkbox. The user must actively agree before a lookup is submitted. Consent is recorded
            with the policy version, purpose and timestamp and may be withdrawn by contacting the
            School. Withdrawal does not invalidate processing already lawfully completed; it may
            prevent further portal retrieval using that consent.
          </p>
          <p>
            Where applicable under the DPDP Act, 2023, the School may process personal data for a
            “certain legitimate use” recognised by the Act (including applicable school-related or
            legal purposes under section 7), or to comply with a legal obligation. This is not a
            broad commercial legitimate-interest basis. The School will identify the applicable
            basis for the specific processing activity and will not use this statement to bypass
            consent where consent is required.
          </p>
        </>
      ),
    },
    {
      id: "children",
      title: "4. Children's personal data",
      content: (
        <>
          <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm leading-6 text-[var(--text)]">
            <strong>Guardian notice:</strong> Many records belong to students under 18. If the
            student is a minor, a parent or guardian should use this portal or be present. The
            School processes this data only to provide certificates. See our Privacy Policy.{" "}
          </p>
          <p>
            Student records may relate to children. A parent or legal guardian must be involved in
            the portal process and should submit or confirm the request on the student’s behalf
            where required. The School relies on its verified school records and approved
            parent/guardian verification procedures; ticking a checkbox alone is not proof of
            identity or parental authority.
          </p>
          <p>
            The portal does not use behavioural tracking, targeted advertising or profiling
            analytics for children. The School applies access restrictions and other safeguards
            appropriate to student records.
          </p>
        </>
      ),
    },
    {
      id: "processors",
      title: "5. Service providers, storage and transfers",
      content: (
        <>
          <p>
            The School uses Firebase / Google Cloud Firestore for application data and Cloudflare R2
            for private certificate-file storage. These providers act as processors/service
            providers on the School’s behalf, subject to the applicable service terms and configured
            security controls. Cloudflare R2 stores finished certificate files in a private,
            access-restricted bucket. Cloudflare Turnstile is used for abuse prevention and may
            process technical request information. When a visitor actively chooses a language using
            the optional Google Translate control, the page text may be sent to Google Translate for
            machine translation. This can include text displayed on the current page. Visitors
            should avoid using translation on pages containing personal certificate results; result
            and print views are excluded from translation by the portal. Google may process the text
            and related technical data under its own service terms and privacy policy. The
            translation feature is not loaded until the visitor opens the language menu.
          </p>
          <p>
            Google Translate is an external service provider used only after the visitor requests
            translation. The School does not control Google’s translation processing, retention or
            any cross-border handling; visitors can continue using the portal in English without
            activating the service. See Google’s{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
            >
              Privacy Policy
            </a>{" "}
            for its own data practices.
          </p>
          <p>
            The original uploaded certificate is retained unchanged in private storage. When a
            certificate is previewed, printed, downloaded or included in a ZIP, the portal creates a
            separate copy with a light diagonal school watermark and a download-time footer. The
            watermark is not written back to the stored original. Successful file and ZIP downloads
            update anonymous aggregate counters on the certificate and by academic session; the
            download metrics do not record who downloaded a certificate, an IP address or a
            user-agent.
          </p>
          <p>
            Configured hosting and storage region: {region}. The School should confirm the actual
            region, processor terms, data-location settings and any cross-border transfer
            requirements before launch. Access to processors is limited to the services needed to
            operate the portal.
          </p>
        </>
      ),
    },
    {
      id: "retention",
      title: "6. Retention and accuracy",
      content: (
        <>
          <p>
            Authorized School administrators can correct inaccurate student details and certificate
            metadata. Wrong-record reports are retained under the School’s approved support-ticket
            and recordkeeping schedule; the School should publish and configure that schedule before
            launch. The student-record retention period is {retentionText} after the end of the
            passing session. Records are deleted on request or after manual review, unless a legal
            hold, statutory requirement, legitimate school-recordkeeping need or pending dispute
            requires continued retention. The configured period does not trigger automatic review
            or deletion.
          </p>
          <p>
            The School must validate this schedule against applicable education, archival,
            limitation and other recordkeeping requirements. Deletion from active systems may be
            followed by expiry from encrypted backups under the documented backup rotation schedule.
            The configured backup rotation period is {backupRotationDays} days. The School must
            confirm this period and align the operational R2 lifecycle policy before production
            launch; copies expire when the rotation period ends.
          </p>
        </>
      ),
    },
    {
      id: "rights",
      title: "7. Your rights and how to exercise them",
      content: (
        <>
          <p>
            Subject to the DPDP Act and other applicable law, a Data Principal or a person legally
            entitled to act for them may request access to information about processing, correction
            or completion of personal data, erasure where retention is not legally required,
            withdrawal of consent and grievance redressal. Requests may require identity and
            authority verification before the School acts.
          </p>
          <p>
            Use the request form below or contact the School. The form creates a tracking
            acknowledgment ID; it does not itself verify identity or guarantee that a request will
            be granted. The School aims to acknowledge requests promptly and respond within 30
            calendar days as an internal service target, or within any shorter/other period required
            by applicable law.
          </p>
        </>
      ),
    },
    {
      id: "grievance",
      title: "8. Grievance Officer and escalation",
      content: (
        <>
          <p>
            <strong>Grievance Officer / Data Protection contact:</strong> {officer}
            <br />
            <strong>Email:</strong>{" "}
            <a className="font-semibold text-[var(--text)] underline" href={`mailto:${officerEmail}`}>
              {officerEmail}
            </a>
            <br />
            <strong>Phone:</strong> {officerPhone}
            <br />
            <strong>Postal address:</strong> {address}
          </p>
          <p>
            Please include your acknowledgment ID, if you have one, and avoid sending unnecessary
            sensitive documents by email. If you are not satisfied with the School’s response, you
            may use the escalation mechanism available under applicable law, including the Data
            Protection Board of India when legally constituted and the relevant provisions are in
            force.
          </p>
        </>
      ),
    },
    {
      id: "security",
      title: "9. Security safeguards",
      content: (
        <>
          <p>
            The School uses reasonable technical and organisational safeguards, including
            administrator multi-factor authentication, role-based access controls, server-side
            authorization, encrypted connections, restricted private certificate storage, audit
            records, rate limits, bot protection and access reviews. Firestore client access is
            denied and service credentials are kept server-side.
          </p>
          <p>
            No system can be guaranteed completely secure. Users should protect their devices, avoid
            sharing access links and report suspected unauthorized access promptly.
          </p>
        </>
      ),
    },
    {
      id: "breach",
      title: "10. Personal data breach notification",
      content: (
        <>
          <p>
            If a personal data breach is suspected, the School will activate its incident-response
            process: contain the incident, preserve evidence, assess affected data and Data
            Principals, document decisions, remediate vulnerabilities and make notifications
            required by applicable law. Where the relevant DPDP provisions and Rules apply, the
            School will notify affected Data Principals without delay and notify the Data Protection
            Board in the form and timeline prescribed by the Rules, including the detailed
            intimation within 72 hours of awareness or any extended period allowed by the Board.
          </p>
          <p>
            The School maintains a restricted breach register and will not publish details that
            could increase risk to affected individuals.
          </p>
        </>
      ),
    },
    {
      id: "cookies",
      title: "11. Cookies and similar technologies",
      content: (
        <>
          <p>
            The portal uses essential cookies and technical storage required for security,
            administrator authentication and session integrity. It does not use marketing or
            advertising cookies, and does not sell personal data or run child-profiling analytics.
            Cloudflare Turnstile may use technical mechanisms necessary to distinguish legitimate
            requests from automated abuse. If you choose a language other than English, Google
            Translate sets the functional “googtrans” cookie to remember and apply your language
            choice. This cookie is not set merely by visiting the portal or opening the language
            menu; it is set only after you select a language. Choosing English resets the
            translation cookie.
          </p>
        </>
      ),
    },
    {
      id: "contact",
      title: "12. Contact and policy changes",
      content: (
        <>
          <p>
            Contact {school} at{" "}
            <a className="font-semibold text-[var(--text)] underline" href={`mailto:${email}`}>
              {email}
            </a>{" "}
            or {address}. This policy may be updated to reflect changes in the portal, law or School
            practices. The version and last-updated date at the top identify the currently published
            text.
          </p>
        </>
      ),
    },
  ];

  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="How the School collects, uses, protects and retains personal data for certificate retrieval."
      version={version}
      updated={updated}
      sections={sections}
      extraToc={{
        id: "rights-request",
        title: "Request access, correction or erasure",
      }}
    >
      <section id="rights-request" className="mt-10 scroll-mt-8 border-t border-[var(--divider)] pt-8">
        <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">
          Request access, correction or erasure
        </h2>
        <p className="mt-2 text-sm leading-7 text-[var(--text)]">
          Create a tracked privacy request. Share only the information needed for the School to
          identify and verify your request.
        </p>
        <form
          onSubmit={submit}
          className="mt-5 grid gap-4 rounded-2xl border border-[var(--divider)] bg-[var(--surface-2)] p-5 sm:grid-cols-2"
        >
          <label className="text-sm font-semibold text-[var(--text)]">
            Request type
            <select
              translate="no"
              value={requestType}
              onChange={(e) => { setRequestType(e.target.value); }}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <option value="access">Access</option>
              <option value="correction">Correction</option>
              <option value="erasure">Erasure</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-[var(--text)]">
            Your name
            <input
              translate="no"
              required
              maxLength={100}
              value={requesterName}
              onChange={(e) => { setRequesterName(e.target.value); }}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--text)]">
            Contact email
            <input
              translate="no"
              type="email"
              required
              maxLength={254}
              value={contactEmail}
              onChange={(e) => { setContactEmail(e.target.value); }}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--text)]">
            Student name
            <input
              translate="no"
              required
              maxLength={100}
              value={studentName}
              onChange={(e) => { setStudentName(e.target.value); }}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--text)] sm:col-span-2">
            Request details
            <textarea
              translate="no"
              required
              minLength={10}
              maxLength={1500}
              rows={4}
              value={description}
              onChange={(e) => { setDescription(e.target.value); }}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
              placeholder="Describe the access, correction or erasure you are requesting."
            />
          </label>
          <label className="flex items-start gap-3 text-sm leading-6 text-[var(--text)] sm:col-span-2">
            <input
              translate="no"
              type="checkbox"
              required
              checked={guardianConfirmation}
              onChange={(e) => { setGuardianConfirmation(e.target.checked); }}
              className="mt-1 size-4"
            />
            <span>
              I am the student, or the parent/guardian of the student (or an authorized
              representative). I confirm that the School may contact me to verify my identity and
              authority.
            </span>
          </label>
          <button
            disabled={busy} aria-busy={busy}
            className="rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] disabled:opacity-50 sm:col-span-2"
          >
            {busy ? "Submitting…" : "Submit privacy request"}
          </button>
          {error && (
            <p role="alert" className="text-sm font-medium text-[var(--danger)] sm:col-span-2">
              {error}
            </p>
          )}
          {acknowledgment && (
            <p
              role="status"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm font-semibold text-[var(--text)] sm:col-span-2"
            >
              Request received. Your acknowledgment ID is{" "}
              <span className="font-mono">{acknowledgment}</span>. Keep it for follow-up.
            </p>
          )}
        </form>
      </section>
      <p className="mt-8 border-t border-[var(--divider)] pt-5 text-xs leading-6 text-[var(--text-muted)]">
        This is a configurable implementation template, not legal advice or a certification of
        compliance. The School must complete the placeholders, verify its retention schedule,
        processor arrangements and commencement obligations, and obtain qualified Indian legal
        review before launch.
      </p>
    </LegalPageLayout>
  );
}
