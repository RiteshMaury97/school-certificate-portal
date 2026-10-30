"use client";
import type { ReactNode } from "react";
import SiteShell from "@/src/components/SiteShell";
export default function PublicShell({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
