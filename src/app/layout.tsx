import { headers } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";

import AppProviders from "@/components/providers/AppProviders";
import { db } from "@/server/firebase-admin";

import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const dynamic = "force-dynamic";

const FALLBACK_NAME = "Satyam International School";
const FALLBACK_DESCRIPTION = "Secure school certificate retrieval and verification portal";
const siteUrl = (
  [process.env.SITE_URL, process.env.APP_ORIGIN].find(Boolean) ?? "https://example.org"
).replace(
  /\/$/,
  "",
);

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c10" },
  ],
  width: "device-width",
  initialScale: 1,
};

async function readSiteIdentity(): Promise<{ name: string; description: string }> {
  try {
    const settings = await db.collection("siteSettings").doc("main").get();
    return {
      name: String(settings.get("schoolName") ?? "").trim() || FALLBACK_NAME,
      description: String(settings.get("tagline") ?? "").trim() || FALLBACK_DESCRIPTION,
    };
  } catch {
    // The page must still render when Firestore is unreachable.
    return { name: FALLBACK_NAME, description: FALLBACK_DESCRIPTION };
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const { name, description } = await readSiteIdentity();
  return {
    metadataBase: new URL(siteUrl),
    title: { default: name, template: `%s | ${name}` },
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
      title: name,
      description,
      url: siteUrl,
      images: [
        { url: "/og-image.png", width: 1200, height: 630, alt: `${name} official school records` },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: name,
      description,
      images: ["/og-image.png"],
    },
    robots: { index: true, follow: true },
  };
}

/** Runs before paint so the saved theme is applied without a light/dark flash. */
const themeInit = `(function(){var r=document.documentElement;try{var t=localStorage.getItem("sis-theme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";}catch(e){var p=window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)").matches:false;r.dataset.theme=p?"dark":"light";r.style.colorScheme=p?"dark":"light";}})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <Script id="theme-init" nonce={nonce} strategy="beforeInteractive">
          {themeInit}
        </Script>
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <AppProviders>
          <Suspense>{children}</Suspense>
        </AppProviders>
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN &&
        process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL ? (
          <Script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src={process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL}
            strategy="afterInteractive"
            nonce={nonce}
          />
        ) : null}
      </body>
    </html>
  );
}
