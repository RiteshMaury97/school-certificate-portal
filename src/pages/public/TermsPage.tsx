"use client";
import LegacyPage from "@/src/screens/TermsPage";
import { usePageMeta } from "@/src/lib/pageMeta";
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
