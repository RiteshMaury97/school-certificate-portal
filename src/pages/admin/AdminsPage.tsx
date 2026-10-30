"use client";
import LegacyPage from "@/src/screens/admin/AdminUsersPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function AdminsPage() {
  const pageMeta = usePageMeta({
    title: "Administrator accounts",
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
