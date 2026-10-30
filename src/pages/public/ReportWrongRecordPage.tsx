"use client";
import { usePageMeta } from "@/src/lib/pageMeta";
import InformationPage from "@/src/screens/InformationPage";
export default function ReportWrongRecordPage() {
  const pageMeta = usePageMeta({
    title: "Report a wrong record",
    description: "Request a review of an incorrect school record.",
    robots: "index, follow",
  });
  return (
    <>
      {pageMeta}
      <InformationPage kind="report" />
    </>
  );
}
