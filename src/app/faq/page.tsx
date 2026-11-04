import FaqView from "@/features/faq/FaqView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/faq");

export default function Page() {
  return <FaqView />;
}
