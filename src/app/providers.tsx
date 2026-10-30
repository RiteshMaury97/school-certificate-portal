"use client";
import type { ReactNode } from "react";
import { HelmetProvider } from "react-helmet-async";
import ThemeProvider from "@/src/features/theme/ThemeProvider";
export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <HelmetProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </HelmetProvider>
  );
}
