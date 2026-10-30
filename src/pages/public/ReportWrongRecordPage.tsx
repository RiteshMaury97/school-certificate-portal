"use client";
import InformationPage from "@/src/screens/InformationPage";
import { usePageMeta } from "@/src/lib/pageMeta";
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
