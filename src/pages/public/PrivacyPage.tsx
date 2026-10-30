"use client";
import LegacyPage from "@/src/screens/PrivacyPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function PrivacyPage() {
  const pageMeta = usePageMeta({
    title: "Privacy Policy",
    description: "Privacy information for Satyam International School digital services.",
    robots: "index, follow",
  });
  return (
    <>
      {pageMeta}
      <LegacyPage />
    </>
  );
}
