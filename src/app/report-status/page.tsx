import ReportStatusView from "@/features/report/ReportStatusView";

export const metadata = { title: "Check report status", robots: { index: false, follow: false } };

export default async function ReportStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const params = await searchParams;
  return <ReportStatusView initialReference={params.reference ?? ""} />;
}
