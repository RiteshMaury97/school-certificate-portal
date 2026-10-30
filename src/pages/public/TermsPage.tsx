"use client";
import { usePageMeta } from "@/src/lib/pageMeta";
import LegacyPage from "@/src/screens/TermsPage";
export default function TermsPage() {
  const pageMeta = usePageMeta({
    title: "Terms and Conditions",
    description: "Terms governing use of school digital services.",
    robots: "index, follow",
  });
  return (
    <>
      {pageMeta}
      <LegacyPage />
    </>
  );
}
