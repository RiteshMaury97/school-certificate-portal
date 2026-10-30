"use client";
import LegacyPage from "@/src/screens/ResultsPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function ResultsPage() {
  const pageMeta = usePageMeta({
    title: "Certificates found",
    description: "Secure certificate search results.",
    robots: "noindex, nofollow",
  });
  return (
    <>
      {pageMeta}
      <LegacyPage />
    </>
  );
}
