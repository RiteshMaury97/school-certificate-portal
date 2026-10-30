"use client";
import LegacyPage from "@/src/screens/admin/AdminCertificateUploadPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function UploadPage() {
  const pageMeta = usePageMeta({
    title: "Upload certificates",
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
