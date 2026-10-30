"use client";
import LegacyPage from "@/src/screens/admin/AdminCertificatesPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function CertificatesPage() {
  const pageMeta = usePageMeta({
    title: "Certificates",
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
