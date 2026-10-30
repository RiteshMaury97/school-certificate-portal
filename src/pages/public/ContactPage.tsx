"use client";
import InformationPage from "@/src/screens/InformationPage";
import { usePageMeta } from "@/src/lib/pageMeta";
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
