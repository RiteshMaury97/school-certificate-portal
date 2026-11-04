import InformationView from "@/features/info/InformationView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/maintenance");

export default function Page() {
  return <InformationView kind="maintenance" />;
}
