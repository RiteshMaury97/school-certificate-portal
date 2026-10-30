"use client";
import InformationPage from "@/src/screens/InformationPage";
import { usePageMeta } from "@/src/lib/pageMeta";
export default function OfflinePage() {
  const pageMeta = usePageMeta({
    title: "Offline",
    description: "School services are temporarily unavailable offline.",
    robots: "noindex, nofollow",
  });
  return (
    <>
      {pageMeta}
      <InformationPage kind="offline" />
    </>
  );
}
