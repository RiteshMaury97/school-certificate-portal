export type SiteMapGroup = "School" | "Certificates" | "Help and support" | "Legal and privacy";

type SiteMapLabelKey =
  | "nav.home"
  | "nav.certificates"
  | "nav.verify"
  | "nav.faq"
  | "nav.contact"
  | "legal.reportWrongRecord"
  | "legal.reportStatus"
  | "legal.dataRights"
  | "legal.terms"
  | "legal.privacy"
  | "siteMap.title";

type SiteMapDescriptionKey =
  | "siteMap.descriptions.home"
  | "siteMap.descriptions.certificates"
  | "siteMap.descriptions.verify"
  | "siteMap.descriptions.faq"
  | "siteMap.descriptions.contact"
  | "siteMap.descriptions.reportWrongRecord"
  | "siteMap.descriptions.reportStatus"
  | "siteMap.descriptions.dataRights"
  | "siteMap.descriptions.terms"
  | "siteMap.descriptions.privacy"
  | "siteMap.descriptions.sitemap";

export type SiteMapPage = {
  path: string;
  labelKey: SiteMapLabelKey;
  descriptionKey: SiteMapDescriptionKey;
  group: SiteMapGroup;
  indexable: boolean;
  inXmlSitemap: boolean;
  inHtmlSitemap: boolean;
  priority: 0 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1;
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
};

export const SITEMAP_PAGE_PATH = "/sitemap";
export const XML_SITEMAP_PATH = `${SITEMAP_PAGE_PATH}.xml`;

export const SITE_MAP = [
  {
    path: "/",
    labelKey: "nav.home",
    descriptionKey: "siteMap.descriptions.home",
    group: "School",
    indexable: true,
    inXmlSitemap: true,
    inHtmlSitemap: true,
    priority: 1,
    changeFrequency: "weekly",
  },
  {
    path: "/certificates",
    labelKey: "nav.certificates",
    descriptionKey: "siteMap.descriptions.certificates",
    group: "Certificates",
    indexable: true,
    inXmlSitemap: true,
    inHtmlSitemap: true,
    priority: 0.9,
    changeFrequency: "weekly",
  },
  {
    path: "/verify",
    labelKey: "nav.verify",
    descriptionKey: "siteMap.descriptions.verify",
    group: "Certificates",
    indexable: true,
    inXmlSitemap: true,
    inHtmlSitemap: true,
    priority: 0.8,
    changeFrequency: "monthly",
  },
  {
    path: "/faq",
    labelKey: "nav.faq",
    descriptionKey: "siteMap.descriptions.faq",
    group: "Help and support",
    indexable: true,
    inXmlSitemap: true,
    inHtmlSitemap: true,
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/contact",
    labelKey: "nav.contact",
    descriptionKey: "siteMap.descriptions.contact",
    group: "Help and support",
    indexable: true,
    inXmlSitemap: true,
    inHtmlSitemap: true,
    priority: 0.7,
    changeFrequency: "monthly",
  },
  {
    path: "/report-wrong-record",
    labelKey: "legal.reportWrongRecord",
    descriptionKey: "siteMap.descriptions.reportWrongRecord",
    group: "Help and support",
    indexable: true,
    inXmlSitemap: true,
    inHtmlSitemap: true,
    priority: 0.6,
    changeFrequency: "monthly",
  },
  {
    path: "/report-status",
    labelKey: "legal.reportStatus",
    descriptionKey: "siteMap.descriptions.reportStatus",
    group: "Help and support",
    indexable: false,
    inXmlSitemap: false,
    inHtmlSitemap: false,
    priority: 0.4,
    changeFrequency: "monthly",
  },
  {
    path: "/data-rights",
    labelKey: "legal.dataRights",
    descriptionKey: "siteMap.descriptions.dataRights",
    group: "Legal and privacy",
    indexable: true,
    inXmlSitemap: true,
    inHtmlSitemap: true,
    priority: 0.5,
    changeFrequency: "yearly",
  },
  {
    path: "/terms",
    labelKey: "legal.terms",
    descriptionKey: "siteMap.descriptions.terms",
    group: "Legal and privacy",
    indexable: true,
    inXmlSitemap: true,
    inHtmlSitemap: true,
    priority: 0.5,
    changeFrequency: "yearly",
  },
  {
    path: "/privacy",
    labelKey: "legal.privacy",
    descriptionKey: "siteMap.descriptions.privacy",
    group: "Legal and privacy",
    indexable: true,
    inXmlSitemap: true,
    inHtmlSitemap: true,
    priority: 0.5,
    changeFrequency: "yearly",
  },
  {
    path: SITEMAP_PAGE_PATH,
    labelKey: "siteMap.title",
    descriptionKey: "siteMap.descriptions.sitemap",
    group: "Help and support",
    indexable: true,
    inXmlSitemap: true,
    inHtmlSitemap: true,
    priority: 0.4,
    changeFrequency: "monthly",
  },
] as const satisfies readonly SiteMapPage[];

export const NO_INDEX_ROUTE_PATHS = [
  "/certificates/results",
  "/certificates/print",
  "/maintenance",
  "/report-status",
] as const;

export const ROBOTS_DISALLOW_PATHS = [
  "/admin",
  "/admin/",
  "/api",
  "/api/",
  ...NO_INDEX_ROUTE_PATHS,
] as const;

export const SITE_MAP_GROUPS: readonly SiteMapGroup[] = [
  "School",
  "Certificates",
  "Help and support",
  "Legal and privacy",
];
