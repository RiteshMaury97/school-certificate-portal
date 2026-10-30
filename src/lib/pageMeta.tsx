"use client";
import { Helmet } from "react-helmet-async";
import { usePublicSiteSettings } from "@/src/lib/use-site-settings";
export type PageMeta = { title: string; description: string; robots?: string };
export function usePageMeta({ title, description, robots = "index, follow" }: PageMeta) {
  const settings = usePublicSiteSettings();
  const schoolName = settings.schoolName || "Satyam International School";
  return (
    <Helmet>
      <title>{`${title} | ${schoolName}`}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta property="og:site_name" content={schoolName} />
    </Helmet>
  );
}
