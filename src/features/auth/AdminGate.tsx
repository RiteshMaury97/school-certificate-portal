"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import ErrorState from "@/components/feedback/ErrorState";
import PageLoader from "@/components/feedback/PageLoader";
import { useAdminSession } from "./admin-session";

/** Shows a loader while the session is verified, then either the console or the sign-in page. */
export default function AdminGate({ children }: { children: ReactNode }) {
  const { state, retry } = useAdminSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === "unauthenticated")
      router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [state.status, router, pathname]);

  if (state.status === "loading") return <PageLoader label="Verifying your session…" />;
  if (state.status === "unauthenticated") return <PageLoader label="Taking you to sign in…" />;
  if (state.status === "error")
    return (
      <main id="main-content" className="mx-auto grid min-h-dvh max-w-lg place-items-center p-6">
        <ErrorState
          title="We couldn’t verify your session"
          description={state.message}
          onRetry={retry}
        />
      </main>
    );
  return <>{children}</>;
}
