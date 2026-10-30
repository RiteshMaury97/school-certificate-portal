"use client";
import LegacyPage from "@/src/screens/FaqPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function FaqPage() {
  const pageMeta = usePageMeta({
    title: "Frequently Asked Questions",
    description: "Answers to common questions about school certificates and services.",
    robots: "index, follow",
  });
  return (
    <>
      {pageMeta}
      <LegacyPage />
    </>
  );
}
