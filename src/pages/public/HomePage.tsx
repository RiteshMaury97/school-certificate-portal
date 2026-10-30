"use client";
import { usePageMeta } from "@/src/lib/pageMeta";
import LegacyPage from "@/src/screens/HomePage";
export default function HomePage() {
  const pageMeta = usePageMeta({
    title: "Home",
    description: "Official digital services of Satyam International School.",
    robots: "index, follow",
  });
  return (
    <>
      {pageMeta}
      <LegacyPage />
    </>
  );
}
