"use client";
import LegacyPage from "@/src/screens/admin/LoginPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function MfaPage() {
  const pageMeta = usePageMeta({
    title: "Multi-factor authentication",
    description: "Satyam International School administration.",
    robots: "noindex, nofollow",
  });
  return (
    <>
      {pageMeta}
      <LegacyPage />
    </>
  );
}
