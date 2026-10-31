import FaqView from "@/features/faq/FaqView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Frequently Asked Questions",
  "Answers to common questions about school certificates and services.",
);

export default function Page() {
  return <FaqView />;
}
