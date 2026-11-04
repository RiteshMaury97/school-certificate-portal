import { seoMetadata } from "@/shared/seo";
import ReportStatusView from "@/features/report/ReportStatusView";

export const metadata = seoMetadata("/report-status");

export default async function ReportStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const params = await searchParams;
  return <ReportStatusView initialReference={params.reference ?? ""} />;
}
