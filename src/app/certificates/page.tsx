import { pageMetadata } from "@/lib/page-metadata";
import FinderView from "@/features/certificates/FinderView";

export const metadata = pageMetadata(
  "Find My Certificates",
  "Find and securely access certificates issued by Satyam International School.",
);

export default function Page() {
  return <FinderView />;
}
