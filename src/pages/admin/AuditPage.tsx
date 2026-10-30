"use client";
import LegacyPage from "@/src/screens/admin/AdminAuditPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function AuditPage() {
  const pageMeta = usePageMeta({
    title: "Audit log",
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
