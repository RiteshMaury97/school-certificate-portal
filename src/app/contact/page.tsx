import ContactView from "@/features/info/ContactView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Contact and support",
  "Contact Satyam International School for support.",
);

export default function Page() {
  return <ContactView />;
}
