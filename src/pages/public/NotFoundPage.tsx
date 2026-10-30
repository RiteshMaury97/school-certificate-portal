"use client";
import LegacyPage from "@/src/screens/NotFoundPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function NotFoundPage() {
  const pageMeta = usePageMeta({
    title: "Page not found",
    description: "The requested page could not be found.",
    robots: "noindex, nofollow",
  });
  return (
    <>
      {pageMeta}
      <LegacyPage />
    </>
  );
}
