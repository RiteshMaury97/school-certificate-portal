"use client";
import { usePageMeta } from "@/src/lib/pageMeta";
import LegacyPage from "@/src/screens/admin/AdminUsersPage";
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
