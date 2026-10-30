"use client";
import LegacyPage from "@/src/screens/PrintPage";
import { usePageMeta } from "@/src/lib/pageMeta";
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
