"use client";
import LegacyPage from "@/src/screens/admin/AdminApprovalsPage";
import { usePageMeta } from "@/src/lib/pageMeta";
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
