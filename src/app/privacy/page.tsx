import PrivacyView from "@/features/legal/PrivacyView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/privacy");

export default function Page() {
  return <PrivacyView />;
}
