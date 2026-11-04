import ResultsView from "@/features/certificates/ResultsView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/certificates/results");

export default function Page() {
  return <ResultsView />;
}
