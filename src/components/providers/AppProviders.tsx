"use client";
import NetworkProgress from "@/components/feedback/NetworkProgress";
import ThemeProvider from "@/features/theme/ThemeProvider";

import type { ReactNode } from "react";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <NetworkProgress />
      {children}
    </ThemeProvider>
  );
}
