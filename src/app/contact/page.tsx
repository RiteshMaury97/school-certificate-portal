import ContactView from "@/features/info/ContactView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/contact");

export default function Page() {
  return <ContactView />;
}
