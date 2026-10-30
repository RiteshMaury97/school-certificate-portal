"use client";
import LegacyPage from "@/src/screens/HomePage";
import { usePageMeta } from "@/src/lib/pageMeta";
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
