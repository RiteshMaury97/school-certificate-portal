import ReportStatusView from "@/features/report/ReportStatusView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Report status",
  "Check a wrong-record report using its reference ID.",
  { index: false },
);

export default function Page() {
  return <ReportStatusView />;
}
