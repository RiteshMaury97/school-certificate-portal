import { pageMetadata } from "@/lib/page-metadata";
import InformationView from "@/features/info/InformationView";

export const metadata = pageMetadata(
  "Data protection and rights",
  "Learn about access, correction, erasure and consent withdrawal requests.",
);

export default function Page() {
  return <InformationView kind="rights" />;
}
