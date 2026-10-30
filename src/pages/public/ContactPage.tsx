"use client";
import { usePageMeta } from "@/src/lib/pageMeta";
import InformationPage from "@/src/screens/InformationPage";
export default function ContactPage() {
  const pageMeta = usePageMeta({
    title: "Contact and support",
    description: "Contact Satyam International School for support.",
    robots: "index, follow",
  });
  return (
    <>
      {pageMeta}
      <InformationPage kind="contact" />
    </>
  );
}
