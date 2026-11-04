import { headers } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";

import AppProviders from "@/components/providers/AppProviders";
import { Toaster } from "@/components/ui/toast";
import { SCHOOL_INFO } from "@/lib/school-info";
import { SITE_SEO } from "@/shared/seo";
import { absoluteUrl, getSiteOrigin } from "@/server/site-origin";
import { getCachedSiteSettings } from "@/server/site-settings-cache";

import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

const FALLBACK_NAME = SCHOOL_INFO.name;
const FALLBACK_DESCRIPTION = SITE_SEO.description;
const siteUrl = getSiteOrigin();

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
    const settings = await getCachedSiteSettings();
    const schoolName = typeof settings.schoolName === "string" ? settings.schoolName : "";
    const tagline = typeof settings.tagline === "string" ? settings.tagline : "";
    return {
      name: schoolName.trim() || FALLBACK_NAME,
      description: tagline.trim() || FALLBACK_DESCRIPTION,
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
        { url: "/favicon.ico?v=2", sizes: "16x16 32x32 48x48" },
        { url: "/icons/icon-192.png?v=2", type: "image/png", sizes: "192x192" },
        { url: "/icons/icon-512.png?v=2", type: "image/png", sizes: "512x512" },
      ],
      apple: "/apple-touch-icon.png?v=2",
    },
    manifest: "/manifest.webmanifest",
    openGraph: {
      type: "website",
      siteName: name,
      title: name,
      description,
      url: absoluteUrl("/"),
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

/** Apply the saved theme before the browser paints, without reading request headers. */
const themeInit = `(function(){var r=document.documentElement;try{var t=localStorage.getItem("sis-theme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=d?"dark":"light";r.style.colorScheme=d?"dark":"light";}catch(e){var p=window.matchMedia?window.matchMedia("(prefers-color-scheme: dark)").matches:false;r.dataset.theme=p?"dark":"light";r.style.colorScheme=p?"dark":"light";}})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script
          id="theme-init"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: themeInit }}
          suppressHydrationWarning
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <AppProviders>
          <Suspense>{children}</Suspense>
        </AppProviders>
        <Toaster />
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
