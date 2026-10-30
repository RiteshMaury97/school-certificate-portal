"use client";
import LegacyPage from "@/src/screens/admin/AdminStudentsPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function StudentsPage() {
  const pageMeta = usePageMeta({
    title: "Students",
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
