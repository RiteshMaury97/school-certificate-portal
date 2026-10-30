import type { Metadata } from "next";
import ClientAppLoader from "@/src/components/ClientAppLoader";
import { db } from "@/src/lib/firebase-admin";
import { headers } from "next/headers";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug?: string[] }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug?.join("/") ?? "";
  const privatePath = ["admin", "print", "results"].some(
    (prefix) => slug === prefix || slug.startsWith(`${prefix}/`),
  );
  if (privatePath)
    return { robots: { index: false, follow: false, nocache: true } };
  const titles: Record<string, string> = {
    terms: "Terms of Use",
    privacy: "Privacy Policy",
    faq: "Frequently Asked Questions",
  };
  return {
    title: titles[slug] ?? undefined,
    alternates: { canonical: `/${slug}` },
  };
}
export default async function CatchAllPage({ params }: Props) {
  const slug = (await params).slug ?? [];
  const isHome = slug.length === 0;
  if (!isHome) return <ClientAppLoader />;
  let schoolName = "School Certificate Portal",
    address = "",
    email = "",
    phone = "",
    logoUrl = "";
  try {
    const settings = await db.collection("siteSettings").doc("main").get();
    schoolName = String(settings.get("schoolName") || schoolName);
    address = String(settings.get("address") || "");
    email = String(settings.get("email") || "");
    phone = String(settings.get("phone") || "");
    logoUrl = String(settings.get("logoUrl") || "");
  } catch {
    /* metadata fallback */
  }
  const organization = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: schoolName,
    url:
      process.env.SITE_URL || process.env.APP_ORIGIN || "https://example.org",
    address: address || undefined,
    email: email || undefined,
    telephone: phone || undefined,
    logo: /^https:\/\//i.test(logoUrl) ? logoUrl : undefined,
  };
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <>
      <ClientAppLoader />
      <script
        nonce={nonce}
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organization).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
