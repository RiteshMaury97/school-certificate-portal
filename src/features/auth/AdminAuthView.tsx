"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import ErrorState from "@/components/feedback/ErrorState";
import PageLoader from "@/components/feedback/PageLoader";
import { usePublicSiteSettings } from "@/lib/use-site-settings";

import { AdminSessionProvider, useAdminSession } from "./admin-session";
import AdminAuthBrandPanel from "./AdminAuthBrandPanel";
import AdminAuthSignInPanel from "./AdminAuthSignInPanel";
import { useAdminSignIn } from "./useAdminSignIn";

function AdminAuthContent() {
  const { state, retry } = useAdminSession();
  const router = useRouter();
  const settings = usePublicSiteSettings();
  const flow = useAdminSignIn();

  useEffect(() => {
    if (state.status === "authenticated") router.replace("/admin");
  }, [state.status, router]);

  if (state.status === "loading" || state.status === "authenticated") {
    return <PageLoader label="Checking administrator session…" />;
  }
  if (state.status === "error") {
    return (
      <main className="grid min-h-dvh place-items-center p-6">
        <ErrorState
          title="We couldn’t verify your session"
          description={state.message}
          onRetry={retry}
        />
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="h-dvh overflow-hidden bg-[#f5f7f4] text-[#17251f] lg:grid lg:grid-cols-2">
      <AdminAuthBrandPanel settings={settings} />
      <AdminAuthSignInPanel settings={settings} flow={flow} />
    </main>
  );
}

export default function AdminAuthView() {
  return (
    <AdminSessionProvider>
      <AdminAuthContent />
    </AdminSessionProvider>
  );
}
