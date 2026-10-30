"use client";
import LegacyPage from "@/src/screens/admin/LoginPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function LoginPage() {
  const pageMeta = usePageMeta({
    title: "Administrator sign in",
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
