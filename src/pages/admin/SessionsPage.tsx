"use client";
import LegacyPage from "@/src/screens/admin/AdminSessionsPage";
import { usePageMeta } from "@/src/lib/pageMeta";
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
