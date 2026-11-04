import type { Metadata } from "next";

/** Public search and social metadata, kept in one place for every public route. */
export const SITE_SEO = {
  description: "Secure school certificate retrieval and verification portal",
  image: "/og-image.png",
  pages: {
    "/": {
      title: "Home",
      description:
        "Student certificate access, certificate verification and official school support for Satyam International School in Zamania, Ghazipur.",
      index: true,
    },
    "/certificates": {
      title: "Find My Certificates",
      description: "Find and securely access certificates issued by Satyam International School.",
      index: true,
    },
    "/verify": {
      title: "Verify a Certificate",
      description: "Verify a certificate issued by Satyam International School.",
      index: true,
    },
    "/faq": {
      title: "Frequently Asked Questions",
      description: "Answers to common questions about school certificates and services.",
      index: true,
    },
    "/contact": {
      title: "Contact and support",
      description: "Contact Satyam International School for support.",
      index: true,
    },
    "/report-wrong-record": {
      title: "Report a wrong record",
      description: "Request a review of an incorrect school record.",
      index: true,
    },
    "/data-rights": {
      title: "Data protection and rights",
      description: "Learn about access, correction, erasure and consent withdrawal requests.",
      index: true,
    },
    "/terms": {
      title: "Terms and Conditions",
      description: "Terms governing use of school digital services.",
      index: true,
    },
    "/privacy": {
      title: "Privacy Policy",
      description: "Privacy information for Satyam International School digital services.",
      index: true,
    },
    "/sitemap": {
      title: "Sitemap",
      description: "Browse the public pages for certificates, verification, school support and policies.",
      index: true,
    },
    "/report-status": {
      title: "Check report status",
      description: "Check the status of a school record report.",
      index: false,
    },
    "/certificates/results": {
      title: "Certificate search results",
      description: "Private certificate search results.",
      index: false,
    },
    "/certificates/print": {
      title: "Print certificates",
      description: "Certificate print view.",
      index: false,
    },
    "/maintenance": {
      title: "Service maintenance",
      description: "School certificate portal maintenance information.",
      index: false,
    },
  },
} as const;

export type SeoPath = keyof typeof SITE_SEO.pages;

export function seoMetadata(path: SeoPath): Metadata {
  const page = SITE_SEO.pages[path];
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title: page.title,
      description: page.description,
      url: path,
      images: [{ url: SITE_SEO.image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [SITE_SEO.image],
    },
    robots: { index: page.index, follow: page.index },
  };
}
