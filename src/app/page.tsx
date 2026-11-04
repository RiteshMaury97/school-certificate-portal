import HomeView from "@/features/home/HomeView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/");

export default function Page() {
  return <HomeView />;
}
