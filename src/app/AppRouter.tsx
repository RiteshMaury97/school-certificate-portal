"use client";
import { BrowserRouter } from "react-router-dom";
import { Suspense } from "react";
import AppProviders from "@/src/app/providers";
import ErrorBoundary from "@/src/app/ErrorBoundary";
import AppRoutes from "@/src/app/routes";
import Skeleton from "@/src/components/feedback/Skeleton";
export default function AppRouter() {
  return (
    <AppProviders>
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<Skeleton />}>
            <AppRoutes />
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </AppProviders>
  );
}
