import { pageMetadata } from "@/lib/page-metadata";
import InformationView from "@/features/info/InformationView";

export const metadata = pageMetadata(
  "Maintenance",
  "School services are temporarily undergoing maintenance.",
  { index: false },
);

export default function Page() {
  return <InformationView kind="maintenance" />;
}
