import { pageMetadata } from "@/lib/page-metadata";
import PrivacyView from "@/features/legal/PrivacyView";

export const metadata = pageMetadata(
  "Privacy Policy",
  "Privacy information for Satyam International School digital services.",
);

export default function Page() {
  return <PrivacyView />;
}
