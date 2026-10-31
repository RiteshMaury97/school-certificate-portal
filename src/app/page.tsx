import HomeView from "@/features/home/HomeView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Home",
  "Student certificate access, certificate verification and official school support for Satyam International School in Zamania, Ghazipur.",
);

export default function Page() {
  return <HomeView />;
}
