import ReportStatusView from "@/features/report/ReportStatusView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/report-status");

export default async function ReportStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const params = await searchParams;
  return <ReportStatusView initialReference={params.reference ?? ""} />;
}
