export type PageVisibility = "public" | "private";
export type AdminRole = "uploader" | "approver" | "superadmin";
export type ApiError = { message: string; code?: string };
export type SiteSettings = {
  schoolName?: string;
  tagline?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  lastUpdated?: string;
};
