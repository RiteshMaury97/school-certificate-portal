import ResultsView from "@/features/certificates/ResultsView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata("Certificates found", "Secure certificate search results.", {
  index: false,
});

export default function Page() {
  return <ResultsView />;
}
