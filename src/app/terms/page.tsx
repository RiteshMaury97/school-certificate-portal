import TermsView from "@/features/legal/TermsView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/terms");

export default function Page() {
  return <TermsView />;
}
