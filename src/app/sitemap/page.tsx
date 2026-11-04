import SiteMapView from "@/features/site-map/SiteMapView";
import { seoMetadata } from "@/shared/seo";

export const metadata = seoMetadata("/sitemap");

export default function Page() {
  return <SiteMapView />;
}
