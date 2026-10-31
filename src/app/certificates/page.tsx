import FinderView from "@/features/certificates/FinderView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Find My Certificates",
  "Find and securely access certificates issued by Satyam International School.",
);

export default function Page() {
  return <FinderView />;
}
