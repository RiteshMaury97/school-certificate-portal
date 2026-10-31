import TermsView from "@/features/legal/TermsView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Terms and Conditions",
  "Terms governing use of school digital services.",
);

export default function Page() {
  return <TermsView />;
}
