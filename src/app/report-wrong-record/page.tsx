import InformationView from "@/features/info/InformationView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/report-wrong-record");

export default function Page() {
  return <InformationView kind="report" />;
}
