"use client";
import { usePageMeta } from "@/src/lib/pageMeta";
import InformationPage from "@/src/screens/InformationPage";
export default function MaintenancePage() {
  const pageMeta = usePageMeta({
    title: "Maintenance",
    description: "School services are temporarily undergoing maintenance.",
    robots: "noindex, nofollow",
  });
  return (
    <>
      {pageMeta}
      <InformationPage kind="maintenance" />
    </>
  );
}
