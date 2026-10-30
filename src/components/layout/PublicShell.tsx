"use client";
import SiteShell from "@/src/components/SiteShell";

import type { ReactNode } from "react";
export default function PublicShell({ children }: { children: ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
