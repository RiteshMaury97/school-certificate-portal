export const SCHOOL_NAME = "Satyam International School";
export const SCHOOL_SUBTITLE = "School Management";
export const TAGLINE = "Nurturing young minds in Zamania, Ghazipur since 2021.";
export const ADDRESS = "Lodipur, Zamania, Ghazipur, Uttar Pradesh – 232329";
export const MANAGED_BY = "Swami Nath Kushwaha Smarak Trust";
export const CAMPUS_SIZE = "2.5 acres";
export const AFFILIATION = "";
export const BOARD = "";

export const PHONE = "+91-9336950476";
export const EMAIL = "sischoolzam@gmail.com";
export const HOURS = "Mon–Sat, 8 AM – 3 PM";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");

export const HIGHLIGHTS = [
  "Health & Medical Check-ups",
  "Transfer Facility Among School Chain",
  "Cultural Exchange Program",
] as const;

export const SOCIAL_URLS = {
  facebook: "https://www.facebook.com/Sischoolzam",
  instagram: "https://www.instagram.com/sischoolzam/",
  youtube: "https://www.youtube.com/@sischoolzam",
  twitter: "https://x.com/sischoolzam",
  whatsapp: "https://wa.me/919336950476",
} as const;
