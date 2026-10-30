"use client";
import { usePageMeta } from "@/src/lib/pageMeta";
import InformationPage from "@/src/screens/InformationPage";
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
