"use client";
import LegacyPage from "@/src/screens/FinderPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function CertificatesPage() {
  const pageMeta = usePageMeta({
    title: "Find My Certificates",
    description: "Find and securely access certificates issued by Satyam International School.",
    robots: "index, follow",
  });
  return (
    <>
      {pageMeta}
      <LegacyPage />
    </>
  );
}
