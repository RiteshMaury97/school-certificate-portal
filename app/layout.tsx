import type { Metadata, Viewport } from "next";
import { db } from "@/src/lib/firebase-admin";
import { Suspense } from "react";
import Script from "next/script";
import "./globals.css";
export const dynamic = "force-dynamic";
const siteUrl = (
  process.env.SITE_URL ||
  process.env.APP_ORIGIN ||
  "https://example.org"
).replace(/\/$/, "");
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#173b68" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
};
export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await db.collection("siteSettings").doc("main").get();
    const name = String(settings.get("schoolName") ?? "Certificate Portal");
    const description = String(
      settings.get("tagline") ??
        "Secure school certificate retrieval and verification portal",
    );
    return {
      metadataBase: new URL(siteUrl),
      title: {
        default: `${name} | Certificate Portal`,
        template: `%s | ${name}`,
      },
      description,
      alternates: { canonical: "/" },
      icons: {
        icon: [
          { url: "/favicon.ico", sizes: "any" },
          { url: "/favicon.svg", type: "image/svg+xml" },
          { url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" },
        ],
        apple: "/icons/icon-192.png",
      },
      manifest: "/manifest.webmanifest",
      openGraph: {
        type: "website",
        siteName: name,
        title: `${name} | Certificate Portal`,
        description,
        url: siteUrl,
        images: [
          {
            url: "/og-image.png",
            width: 1200,
            height: 630,
            alt: `${name} certificate portal`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title: `${name} | Certificate Portal`,
        description,
        images: ["/og-image.png"],
      },
      robots: { index: true, follow: true },
    };
  } catch {
    return {
      metadataBase: new URL(siteUrl),
      title: "Certificate Portal",
      description:
        "Secure school certificate retrieval and verification portal",
      alternates: { canonical: "/" },
      icons: {
        icon: [
          { url: "/favicon.ico", sizes: "any" },
          { url: "/favicon.svg", type: "image/svg+xml" },
        ],
        apple: "/icons/icon-192.png",
      },
      manifest: "/manifest.webmanifest",
      openGraph: {
        type: "website",
        title: "Certificate Portal",
        description:
          "Secure school certificate retrieval and verification portal",
        url: siteUrl,
        images: [{ url: "/og-image.png", width: 1200, height: 630 }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Certificate Portal",
        description:
          "Secure school certificate retrieval and verification portal",
        images: ["/og-image.png"],
      },
      robots: { index: true, follow: true },
    };
  }
}
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <Suspense>{children}</Suspense>
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN &&
        process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL ? (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src={process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL}
            strategy="afterInteractive"
          />
        ) : null}
      </body>
    </html>
  );
}
