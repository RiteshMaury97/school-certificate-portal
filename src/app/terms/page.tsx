import { pageMetadata } from "@/lib/page-metadata";
import TermsView from "@/features/legal/TermsView";

export const metadata = pageMetadata(
  "Terms and Conditions",
  "Terms governing use of school digital services.",
);

export default function Page() {
  return <TermsView />;
}
