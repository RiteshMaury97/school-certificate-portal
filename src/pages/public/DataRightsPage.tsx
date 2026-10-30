"use client";
import { usePageMeta } from "@/src/lib/pageMeta";
import InformationPage from "@/src/screens/InformationPage";
export default function DataRightsPage() {
  const pageMeta = usePageMeta({
    title: "Data protection and rights",
    description: "Learn about access, correction, erasure and consent withdrawal requests.",
    robots: "index, follow",
  });
  return (
    <>
      {pageMeta}
      <InformationPage kind="rights" />
    </>
  );
}
