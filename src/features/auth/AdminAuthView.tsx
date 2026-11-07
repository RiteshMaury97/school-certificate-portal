"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import ErrorState from "@/components/feedback/ErrorState";
import PageLoader from "@/components/feedback/PageLoader";
import { initializeAppCheckEarly } from "@/lib/firebase-client";

import { AdminSessionProvider, useAdminSession } from "./admin-session";
import BrandPanel from "./BrandPanel";
import PageFooter from "./PageFooter";
import SignInForm from "./SignInForm";
import { useAdminSignIn } from "./useAdminSignIn";

function AdminAuthContent() {
  const { state, retry } = useAdminSession();
  const router = useRouter();
  const flow = useAdminSignIn();

  useEffect(() => {
    void initializeAppCheckEarly();
  }, []);

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
    <main
      id="main-content"
      className="flex min-h-dvh flex-col lg:min-h-dvh lg:grid-cols-[45%_55%] lg:grid"
    >
      <BrandPanel />
      <div className="flex flex-1 flex-col lg:min-h-dvh">
        <SignInForm flow={flow} />
        <PageFooter />
      </div>
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
