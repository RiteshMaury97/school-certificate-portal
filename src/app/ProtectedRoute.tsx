"use client";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAdminSession } from "@/src/features/auth/useAdminSession";
import Skeleton from "@/src/components/feedback/Skeleton";
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { authenticated, loading } = useAdminSession();
  if (loading) return <Skeleton />;
  if (!authenticated) return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}
