"use client";
import { usePageMeta } from "@/src/lib/pageMeta";
import LegacyPage from "@/src/screens/admin/AdminApprovalsPage";
export default function ApprovalsPage() {
  const pageMeta = usePageMeta({
    title: "Approval queue",
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
