"use client";
import LegacyPage from "@/src/screens/admin/AdminSettingsPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function SettingsPage() {
  const pageMeta = usePageMeta({
    title: "School settings",
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
