import PrintView from "@/features/certificates/PrintView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/certificates/print");

export default function Page() {
  return <PrintView />;
}
