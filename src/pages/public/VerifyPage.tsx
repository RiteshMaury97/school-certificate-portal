"use client";
import LegacyPage from "@/src/screens/VerifyPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function VerifyPage() {
  const pageMeta = usePageMeta({
    title: "Verify a Certificate",
    description: "Verify a certificate issued by Satyam International School.",
    robots: "index, follow",
  });
  return (
    <>
      {pageMeta}
      <LegacyPage />
    </>
  );
}
