import FinderView from "@/features/certificates/FinderView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/certificates");

export default function Page() {
  return <FinderView />;
}
