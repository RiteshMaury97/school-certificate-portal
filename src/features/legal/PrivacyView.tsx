"use client";
/* eslint-disable max-lines -- reason: this privacy page is awaiting a behavior-preserving component extraction. */
import { useState } from "react";

import { FormErrorSummary } from "@/components/forms/FormErrorSummary";
import { useFormValidation } from "@/components/forms/useFormValidation";
import LegalPageLayout from "@/components/layout/LegalPageLayout";
import { appCheckHeaders } from "@/lib/firebase-client";
import { usePublicSiteSettings } from "@/lib/use-site-settings";
import { dataRightsRequestSchema } from "@/shared/validation";

import type { LegalSection } from "@/components/layout/LegalPageLayout";
import type { SubmitEvent } from "react";


function textOr(value: string | undefined | null, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

const region = textOr(process.env.NEXT_PUBLIC_DATA_HOSTING_REGION, "{{HOSTING_REGION}}");
const version = textOr(process.env.NEXT_PUBLIC_PRIVACY_POLICY_VERSION, "2026-10");

// eslint-disable-next-line max-lines-per-function -- reason: this legacy privacy page coordinates policy content and data rights request handling.
export default function PrivacyPage() {
  const settings = usePublicSiteSettings();
  const school = textOr(settings.schoolName, "Satyam International School");
  const address = textOr(settings.address, "");
  const email = textOr(settings.email, "");
  const officer = textOr(settings.grievanceOfficerName, "");
  const updated = textOr(settings.lastUpdated, "No data found");
  const retentionYears =
    settings.retentionYears ?? Number(process.env.NEXT_PUBLIC_RETENTION_YEARS ?? "7");
  const backupRotationDays = settings.backupRotationDays ?? 30;
  const [requestType, setRequestType] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [description, setDescription] = useState("");
  const [guardianConfirmation, setGuardianConfirmation] = useState(false);
  const [acknowledgment, setAcknowledgment] = useState("");
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const validation = useFormValidation(dataRightsRequestSchema, {
    requestType,
    requesterName,
    contactEmail,
    studentName,
    description,
    guardianConfirmation,
  });

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validation.validate(true)) return;
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
      const data: unknown = await response.json();
      if (typeof data !== "object" || data === null) throw new Error("Unable to submit request.");
      const errorValue = "error" in data ? data.error : undefined;
      const acknowledgmentId = "acknowledgmentId" in data ? data.acknowledgmentId : undefined;
      const confirmationSent = "emailConfirmationSent" in data ? data.emailConfirmationSent : false;
      if (!response.ok)
        throw new Error(typeof errorValue === "string" ? errorValue : "Unable to submit request.");
      setAcknowledgment(typeof acknowledgmentId === "string" ? acknowledgmentId : "");
      setEmailConfirmationSent(confirmationSent === true);
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
            {school} (SiS) is the Data Fiduciary for personal data processed through this portal.
            The School decides the purposes and means of processing and is responsible for handling
            requests and grievances.
          </p>
          <p>
            Postal address: Lodipur Zamania Ghazipur (U.P.)232329.
            <br />
            General contact: 9336950476
            <br />
            Email:{" "}
            <a className="font-semibold text-[var(--text)]" href={`mailto:$sischoolzam@gmail.com`}>
              sischoolzam@gmail.com
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
            The certificate portal securely processes student information to facilitate certificate
            verification and retrieval. Students can access their academic documents by providing
            the required identification details, including their full name, parents’ names, and
            passing session. Relevant certificate information, such as document type, certificate
            number, and date of issuance, is used solely to locate, verify, and provide the
            corresponding academic records.
          </p>
          <p>
            For security and administration, the system may also record consent version and
            timestamp, hashed network identifiers, request outcomes, administrator audit events and
            technical security data. Do not submit information that the form does not request.
          </p>
          <p>
            For administrator account security, the School stores a hash of the administrator&apos;s
            network IP address and the country code supplied by the hosting provider. These are used
            to rate-limit sign-in attempts, enforce the School&apos;s admin location policy and
            audit access. The raw IP address is not stored in these location-policy records, and
            browser GPS is not used.
          </p>
          <p>
            If you submit a wrong-record report, the School receives the name, passing session,
            issue description, contact detail and consent you provide. The portal assigns a
            reference ID and records ticket status, staff handling notes and a hashed network
            identifier for abuse prevention and audit purposes.
          </p>
          <p>
            The certificate portal provides an optional “Was this helpful?” feedback feature to help
            the School evaluate and improve the accessibility, clarity, and usefulness of its online
            services. When feedback is submitted, the portal collects and stores only the selected
            response (helpful or not helpful), an optional comment limited to 200 characters, the
            date and time of submission, and the page address or path associated with the feedback.
            Users are advised not to include names, contact information, student identification
            details, certificate numbers, or other personal or confidential information in their
            comments. To prevent spam, automated submissions, and misuse of the feedback feature,
            the portal maintains a separate, temporary rate-limiting mechanism that uses a hashed
            network identifier. This identifier is used exclusively for abuse prevention, is
            retained for a limited period, and is not included in or directly associated with the
            stored feedback record. Feedback information is used for service evaluation and
            improvement and is accessible only to authorised School personnel responsible for
            reviewing and managing portal feedback.
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
            The School processes personal data in accordance with the Digital Personal Data
            Protection Act, 2023 (DPDP Act), and other applicable legal requirements. Where
            permitted by law, certain information may be processed without obtaining separate
            consent when the processing falls within a recognised “certain legitimate use” under the
            Act, including applicable educational, school-related, or statutory purposes covered by
            Section 7. Personal data may also be processed where necessary to fulfil legal
            obligations, comply with applicable regulations, or respond to lawful requests from
            competent authorities. The School will determine and document the appropriate legal
            basis for each specific processing activity. These provisions will not be interpreted as
            a general commercial legitimate-interest exemption or used to avoid obtaining consent
            where consent is legally required. All processing will remain subject to applicable data
            protection principles, safeguards, and individual rights.
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
            As student records may contain information relating to minors, the School takes
            additional measures to protect their privacy and personal data. Parents or legally
            authorised guardians are required to participate in the process and provide or approve
            requests on behalf of students whenever applicable. The School verifies parental or
            guardian authority through its established verification procedures and official school
            records. Providing consent through a checkbox or online declaration alone does not
            constitute sufficient proof of identity or legal authority.
          </p>
          <p>
            The portal does not engage in behavioural monitoring, targeted advertising, or profiling
            activities involving children. Appropriate security measures, restricted access
            controls, and data protection practices are implemented to safeguard student information
            against unauthorised access, misuse, or disclosure.
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
            The School uses trusted technology infrastructure to operate and maintain the
            certificate portal securely. Firebase and Google Cloud Firestore are used to manage
            application data, while Cloudflare R2 provides private storage for digital certificate
            documents. These services operate on behalf of the School in accordance with their
            applicable service terms and the security configurations implemented by the School. All
            certificate files are maintained in a private, access-controlled Cloudflare R2 storage
            environment. Access to these documents is restricted to authorised application processes
            and permitted users. Cloudflare Turnstile is integrated to protect the portal against
            automated submissions, spam, and other forms of misuse. As part of this protection, it
            may process certain technical information associated with incoming requests. The portal
            provides language selection through locally hosted translation files. Changing the
            display language does not transmit page content or personal information to any external
            translation service.
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
            The School maintains procedures to ensure that student information and certificate
            records remain accurate and up to date. Authorised School administrators may review and
            make necessary corrections to student details and certificate metadata when inaccuracies
            are identified or reported. Requests concerning incorrect student records are handled
            through the School’s designated support and record-correction process. Such reports and
            related correspondence are retained in accordance with the School’s officially approved
            recordkeeping and support-ticket retention policy, which will be established and
            published before the portal becomes operational. Student records are retained for a
            period of <strong>{retentionYears === 7 ? "seven (7)" : retentionYears} years</strong> following the end of the relevant passing
            session. Upon expiry of this period, records are reviewed for secure deletion or
            anonymisation, subject to applicable legal and administrative requirements. Deletion
            requests are assessed by the School on a case-by-case basis. Information may be retained
            where continued storage is necessary to comply with legal or statutory obligations,
            satisfy legitimate academic recordkeeping requirements, address an ongoing dispute, or
            comply with a legal hold. Where no such requirement applies, the School will proceed
            with deletion in accordance with its data retention and disposal procedures.
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
            <strong>Email:</strong>
            <a className="font-semibold text-[var(--text)]" href={`mailto:${textOr(settings.grievanceOfficerEmail, email)}`}>
              {textOr(settings.grievanceOfficerEmail, email)}
            </a>
            <br />
            <strong>Phone:</strong> {textOr(settings.grievanceOfficerPhone, "Contact the School office")}
            <br />
            <strong>Postal address:</strong> Lodipur Zamania Ghazipur (U.P.),232329
          </p>
          <p>
            When contacting the School regarding a privacy concern, data protection request, or
            complaint, please provide your acknowledgment or reference number, if one has been
            issued. To protect your personal information, include only the details necessary to
            explain your concern and avoid sharing confidential documents, identity proofs, or other
            sensitive information through ordinary email unless specifically requested through an
            authorised and secure channel. The School will review and address complaints in
            accordance with its established grievance-redressal procedures and applicable data
            protection requirements. If you are dissatisfied with the resolution provided by the
            School, you may exercise your right to seek further remedies through the appropriate
            legal and regulatory channels, including the Data Protection Board of India, subject to
            its legal constitution, jurisdiction, and the commencement of the relevant provisions of
            applicable law.
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
          <p>
            The School maintains an incident register to record suspected or confirmed data security
            incidents, the actions taken to investigate and address them, and decisions regarding
            any required notifications to affected individuals or relevant authorities. This
            register supports internal accountability, incident management, and ongoing improvements
            to the School’s data protection practices. Maintaining this register does not guarantee
            a specific legal or regulatory outcome, nor does it replace the need for professional
            legal guidance. Decisions concerning incident handling, reporting obligations, and
            regulatory compliance are made in accordance with applicable laws and, where necessary,
            in consultation with the School’s legal and data privacy advisers.
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
            requests from automated abuse. If you choose a language other than English, the portal
            stores your language choice in browser local storage so it can be restored on your next
            visit. The choice is not sent in a cookie.
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
            <a className="font-semibold text-[var(--text)]" href={`mailto:${email}`}>
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
      <section
        id="rights-request"
        className="mt-10 scroll-mt-8 border-t border-[var(--divider)] pt-8"
      >
        <h2 className="text-xl font-bold tracking-tight text-[var(--text)]">
          Request access, correction or erasure
        </h2>
        <p className="mt-2 text-sm leading-7 text-[var(--text)]">
          Create a tracked privacy request. Share only the information needed for the School to
          identify and verify your request.
        </p>
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          noValidate
          className="privacy-request-form mt-6 grid items-start gap-x-5 gap-y-5 rounded-2xl border border-[var(--divider)] bg-[var(--surface-2)] p-5 shadow-sm sm:grid-cols-2 sm:p-6"
        >
          <label className="text-sm font-semibold text-[var(--text)]">
            Request type
            <select
              translate="no"
              required
              aria-required="true"
              value={requestType}
              onChange={(e) => {
                setRequestType(e.target.value);
              }}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <option value="" disabled>
                Select a request type
              </option>
              <option value="access">Access</option>
              <option value="correction">Correction</option>
              <option value="erasure">Erasure</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-[var(--text)]">
            Your name
            <input
              translate="no"
              aria-label="Your name"
              required
              aria-required="true"
              minLength={2}
              maxLength={80}
              pattern="[\\p{L}\\p{M} .'-]+"
              value={requesterName}
              onChange={(e) => {
                setRequesterName(e.target.value);
              }}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--text)]">
            Contact email
            <input
              translate="no"
              aria-label="Contact email"
              type="email"
              required
              aria-required="true"
              minLength={5}
              maxLength={254}
              autoComplete="email"
              inputMode="email"
              value={contactEmail}
              onChange={(e) => {
                setContactEmail(e.target.value);
              }}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--text)]">
            Student name
            <input
              translate="no"
              aria-label="Student name"
              required
              aria-required="true"
              minLength={2}
              maxLength={80}
              pattern="[\\p{L}\\p{M} .'-]+"
              value={studentName}
              onChange={(e) => {
                setStudentName(e.target.value);
              }}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            />
          </label>
          <label className="text-sm font-semibold text-[var(--text)] sm:col-span-2">
            Request details
            <textarea
              translate="no"
              aria-label="Request details"
              required
              aria-required="true"
              minLength={10}
              maxLength={1500}
              rows={4}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
              }}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
              placeholder="Describe the access, correction or erasure you are requesting."
            />
          </label>
          <label className="flex items-start gap-3 text-sm leading-6 text-[var(--text)] sm:col-span-2">
            <input
              translate="no"
              aria-label="Confirm student or guardian authority"
              type="checkbox"
              required
              aria-required="true"
              checked={guardianConfirmation}
              onChange={(e) => {
                setGuardianConfirmation(e.target.checked);
              }}
              className="mt-1 size-4"
            />
            <span>
              I am the student, or the parent/guardian of the student (or an authorized
              representative). I confirm that the School may contact me to verify my identity and
              authority.
            </span>
          </label>
          <button
            aria-busy={busy}
            className="rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] sm:col-span-2"
          >
            {busy ? "Submittingâ€¦" : "Submit privacy request"}
          </button>
          {error && (
            <p role="alert" className="text-sm font-medium text-[var(--danger)] sm:col-span-2">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <FormErrorSummary errors={validation.errors} />
          </div>
          {acknowledgment && (
            <p
              role="status"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm font-semibold text-[var(--text)] sm:col-span-2"
            >
              Request received. Your acknowledgment ID is{" "}
              <span className="font-mono">{acknowledgment}</span>. Keep it for follow-up.
              {emailConfirmationSent
                ? " A copy of your request was emailed to you."
                : " The request is saved, but the confirmation email could not be sent."}
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
