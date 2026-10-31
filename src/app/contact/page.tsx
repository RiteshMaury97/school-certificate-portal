import { pageMetadata } from "@/lib/page-metadata";
import InformationView from "@/features/info/InformationView";

export const metadata = pageMetadata(
  "Contact and support",
  "Contact Satyam International School for support.",
);

export default function Page() {
  return <InformationView kind="contact" />;
}
