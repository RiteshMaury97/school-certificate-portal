import { pageMetadata } from "@/lib/page-metadata";
import HomeView from "@/features/home/HomeView";

export const metadata = pageMetadata(
  "Home",
  "Official digital services of Satyam International School.",
);

export default function Page() {
  return <HomeView />;
}
