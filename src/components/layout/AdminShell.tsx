"use client";
import type { ReactNode } from "react";
export default function AdminShell({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-slate-50 text-slate-900">{children}</div>;
}
