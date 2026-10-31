import { pageMetadata } from "@/lib/page-metadata";
import PrintView from "@/features/certificates/PrintView";

export const metadata = pageMetadata(
  "Print certificates",
  "Print view of certificate records.",
  { index: false },
);

export default function Page() {
  return <PrintView />;
}
