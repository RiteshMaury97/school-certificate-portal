import InformationView from "@/features/info/InformationView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Report a wrong record",
  "Request a review of an incorrect school record.",
);

export default function Page() {
  return <InformationView kind="report" />;
}
