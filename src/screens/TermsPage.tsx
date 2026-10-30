"use client";
import LegalPageLayout, {
  LegalSection,
} from "@/src/components/LegalPageLayout";
import { usePublicSiteSettings } from "@/src/lib/use-site-settings";

const version = process.env.NEXT_PUBLIC_TERMS_VERSION || "1.0";

export default function TermsPage() {
  const settings = usePublicSiteSettings();
  const school = settings.schoolName ?? "";
  const address = settings.address ?? "";
  const email = settings.email ?? "";
  const jurisdiction = settings.jurisdiction ?? "";
  const updated = settings.lastUpdated ?? "Not provided";
  const sections: LegalSection[] = [
    {
      id: "acceptance",
      title: "1. Acceptance and scope",
      content: (
        <>
          <p>
            These Terms govern your access to the student certificate retrieval
            portal operated by {school} (the “School”). By using the portal, you
            agree to these Terms. If you do not agree, do not use the portal;
            contact the School office for assistance.
          </p>
          <p>
            The portal is a limited facility for locating and retrieving
            certificate records maintained by the School. It is not a general
            student-information service.
          </p>
        </>
      ),
    },
    {
      id: "acceptable-use",
      title: "2. Acceptable use",
      content: (
        <>
          <p>
            Use the portal only for a genuine certificate-retrieval purpose and
            only for records you are entitled to access. You must provide
            accurate details, keep downloaded documents secure and promptly tell
            the School if you believe a record or access link has been disclosed
            improperly.
          </p>
          <p>
            You must not access another person’s record without authority,
            impersonate a student or guardian, probe or bypass security
            controls, interfere with the portal, upload malicious content, or
            use retrieved documents for fraud, harassment or any unlawful
            purpose.
          </p>
        </>
      ),
    },
    {
      id: "automated-access",
      title: "3. No scraping or automated access",
      content: (
        <>
          <p>
            Scraping, crawling, bulk querying, enumeration, scripted requests,
            bots, headless-browser automation and other automated access are
            prohibited unless the School has given prior written permission. You
            must not reverse engineer the portal or attempt to discover records
            by varying names, sessions or other identifiers.
          </p>
          <p>
            The School may apply rate limits, bot checks, monitoring and
            technical restrictions to protect student information and service
            availability.
          </p>
        </>
      ),
    },
    {
      id: "certificates",
      title: "4. Certificate copies and official originals",
      content: (
        <>
          <p>
            A file retrieved through this portal is an electronic copy provided
            for reference and convenience. It is not a newly issued original, a
            certified true copy or a guarantee that a third party will accept
            it.
          </p>
          <p>
            Copies delivered through preview, print, download or ZIP are
            watermarked with the School name and delivery date/time. The
            original file held by the School remains unchanged. A watermark may
            affect the validity of an embedded digital signature in the
            delivered copy.
          </p>
          <p>
            Where an original, duplicate, certified copy or verification is
            required, the official document issued or confirmed by the School is
            authoritative. Contact the School office to obtain an original or to
            verify a certificate. Receiving institutions may have their own
            document requirements.
          </p>
        </>
      ),
    },
    {
      id: "availability",
      title: "5. Availability and changes",
      content: (
        <>
          <p>
            The portal is provided on an “as available” basis. The School does
            not guarantee uninterrupted, error-free or continuous availability,
            that every historical record will be present, or that a download
            will be compatible with every device or third-party system.
          </p>
          <p>
            The School may maintain, modify, suspend or discontinue any part of
            the portal, including for maintenance, legal, security or
            operational reasons. To the extent permitted by law, the School is
            not liable for loss caused solely by temporary unavailability or
            interruptions.
          </p>
        </>
      ),
    },
    {
      id: "access-revocation",
      title: "6. Suspension and revocation of access",
      content: (
        <>
          <p>
            The School may suspend, restrict or revoke access, without prior
            notice where reasonably necessary, if it suspects misuse,
            unauthorized access, a security risk, inaccurate or abusive
            submissions, a breach of these Terms, or where required by law. The
            School may preserve relevant security records and investigate
            suspected misuse.
          </p>
          <p>
            Suspension of portal access does not remove any rights you may have
            to request records or exercise rights under applicable law through
            the School’s official contact channels.
          </p>
        </>
      ),
    },
    {
      id: "privacy",
      title: "7. Privacy and personal data",
      content: (
        <>
          <p>
            Use of the portal also involves the processing described in the{" "}
            <a
              className="font-semibold text-blue-800 underline underline-offset-2"
              href="/privacy"
            >
              Privacy Policy
            </a>
            . The School processes personal data for certificate retrieval and
            related security and recordkeeping purposes in accordance with
            applicable law, including the Digital Personal Data Protection Act,
            2023, to the extent in force and applicable.
          </p>
        </>
      ),
    },
    {
      id: "liability",
      title: "8. Responsibility and limitation",
      content: (
        <>
          <p>
            You are responsible for protecting your device, downloaded files and
            any access token or link. You should check that a retrieved copy is
            complete and contact the School if it appears incorrect or damaged.
          </p>
          <p>
            Nothing in these Terms excludes or limits liability where such
            exclusion or limitation is prohibited by applicable law, or affects
            statutory rights that cannot be waived.
          </p>
        </>
      ),
    },
    {
      id: "law",
      title: "9. Governing law and jurisdiction",
      content: (
        <>
          <p>
            These Terms are governed by the laws of India. Subject to any
            mandatory jurisdiction or dispute-resolution requirements under
            applicable law, the courts at {jurisdiction} shall have jurisdiction
            over disputes arising from these Terms.
          </p>
        </>
      ),
    },
    {
      id: "contact",
      title: "10. Contact and updates",
      content: (
        <>
          <p>
            <strong>{school}</strong>
            <br />
            {address}
            <br />
            Email:{" "}
            <a
              className="font-semibold text-blue-800 underline underline-offset-2"
              href={`mailto:${email}`}
            >
              {email}
            </a>
          </p>
          <p>
            The School may update these Terms from time to time. The version and
            last-updated date shown above identify the current published text.
            Material changes will be reflected on this page.
          </p>
        </>
      ),
    },
  ];
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      subtitle="Rules for responsible use of the School’s certificate retrieval service."
      version={version}
      updated={updated}
      sections={sections}
    >
      <p className="mt-10 border-t border-slate-200 pt-5 text-xs leading-6 text-slate-500">
        School identity and contact details on this page are loaded from the
        public site settings maintained by the superadmin. These Terms require
        review and approval by the School and qualified Indian legal counsel
        before production.
      </p>
    </LegalPageLayout>
  );
}
