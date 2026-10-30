"use client";
import dynamic from "next/dynamic";
import Skeleton from "@/src/components/feedback/Skeleton";
const AppRouter = dynamic(() => import("@/src/app/AppRouter"), {
  ssr: false,
  loading: () => <Skeleton />,
});
export default function AppRouterMount() {
  return <AppRouter />;
}
