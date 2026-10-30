"use client";
import { HelmetProvider } from "react-helmet-async";

import ThemeProvider from "@/src/features/theme/ThemeProvider";

import type { ReactNode } from "react";
export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <HelmetProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </HelmetProvider>
  );
}
