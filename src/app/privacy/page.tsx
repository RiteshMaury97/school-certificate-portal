import PrivacyView from "@/features/legal/PrivacyView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Privacy Policy",
  "Privacy information for Satyam International School digital services.",
);

export default function Page() {
  return <PrivacyView />;
}
