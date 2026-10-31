"use client";
import type { ReactNode } from "react";
import NetworkProgress from "@/components/feedback/NetworkProgress";
import ThemeProvider from "@/features/theme/ThemeProvider";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <NetworkProgress />
      {children}
    </ThemeProvider>
  );
}
