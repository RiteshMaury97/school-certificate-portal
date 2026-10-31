"use client";
import { useEffect, type ReactNode } from "react";

/** The admin area is English-only and must not be touched by the page translator. */
export default function AdminArea({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = "en";
  }, []);
  return (
    <div className="notranslate" translate="no">
      {children}
    </div>
  );
}
