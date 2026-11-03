"use client";
import NetworkProgress from "@/components/feedback/NetworkProgress";
import ThemeProvider from "@/features/theme/ThemeProvider";
import { LocaleProvider } from "@/i18n/locale-provider";

import type { ReactNode } from "react";

export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <NetworkProgress />
        {children}
      </ThemeProvider>
    </LocaleProvider>
  );
}
