"use client";
import LegacyPage from "@/src/screens/admin/AdminBackupPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function BackupPage() {
  const pageMeta = usePageMeta({
    title: "Backup and retention",
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
