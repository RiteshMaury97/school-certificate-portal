"use client";

import { usePathname } from "next/navigation";

import Skeleton from "@/components/feedback/Skeleton";

export default function Loading() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <Skeleton />;
}
