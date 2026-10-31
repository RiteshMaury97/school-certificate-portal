"use client";

import { usePublicSiteSettings } from "@/lib/use-site-settings";

import AdminAuthBrandPanel from "./AdminAuthBrandPanel";
import AdminAuthSignInPanel from "./AdminAuthSignInPanel";
import { useAdminSignIn } from "./useAdminSignIn";

export default function AdminAuthView() {
  const settings = usePublicSiteSettings();
  const flow = useAdminSignIn();

  return (
    <main id="main-content" tabIndex={-1} className="h-dvh overflow-hidden bg-[#f5f7f4] text-[#17251f] lg:grid lg:grid-cols-2">
      <AdminAuthBrandPanel settings={settings} />
      <AdminAuthSignInPanel settings={settings} flow={flow} />
    </main>
  );
}
