"use client";
import { usePageMeta } from "@/src/lib/pageMeta";
import LegacyPage from "@/src/screens/admin/AdminSessionsPage";
export default function SessionsPage() {
  const pageMeta = usePageMeta({
    title: "Sessions and certificate types",
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
