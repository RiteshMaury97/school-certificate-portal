import { pageMetadata } from "@/lib/page-metadata";
import InformationView from "@/features/info/InformationView";

export const metadata = pageMetadata(
  "Report a wrong record",
  "Request a review of an incorrect school record.",
);

export default function Page() {
  return <InformationView kind="report" />;
}
