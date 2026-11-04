import VerifyView from "@/features/verify/VerifyView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/verify");

export default function Page() {
  return <VerifyView />;
}
