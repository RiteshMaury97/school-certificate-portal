import SiteMapView from "@/features/site-map/SiteMapView";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata(
  "Sitemap",
  "Browse the public pages for certificates, verification, school support and policies.",
);

export default function Page() {
  return <SiteMapView />;
}
