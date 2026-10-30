"use client";
import LegacyPage from "@/src/screens/admin/AdminDashboardPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function DashboardPage() {
  const pageMeta = usePageMeta({
    title: "Administration dashboard",
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
