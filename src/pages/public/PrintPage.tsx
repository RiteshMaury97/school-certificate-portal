"use client";
import { usePageMeta } from "@/src/lib/pageMeta";
import LegacyPage from "@/src/screens/PrintPage";
export default function PrintPage() {
  const pageMeta = usePageMeta({
    title: "Print certificates",
    description: "Print view of certificate records.",
    robots: "noindex, nofollow",
  });
  return (
    <>
      {pageMeta}
      <LegacyPage />
    </>
  );
}
