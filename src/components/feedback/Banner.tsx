import type { ReactNode } from "react";
export default function Banner({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "success";
}) {
  const styles = {
    info: "border-blue-200 bg-blue-50 text-blue-950",
    warning: "border-amber-300 bg-amber-50 text-amber-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  };
  return (
    <aside role="status" className={`rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>
      {children}
    </aside>
  );
}
