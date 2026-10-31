import VerifyView from "@/features/verify/VerifyView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Verify a Certificate",
  "Verify a certificate issued by Satyam International School.",
);

export default function Page() {
  return <VerifyView />;
}
