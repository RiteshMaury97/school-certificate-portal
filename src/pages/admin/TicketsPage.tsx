"use client";
import LegacyPage from "@/src/screens/admin/AdminTicketsPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function TicketsPage() {
  const pageMeta = usePageMeta({
    title: "Support tickets and data rights",
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
