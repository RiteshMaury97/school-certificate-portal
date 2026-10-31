import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="sis-admin-shell flex min-h-screen bg-[var(--bg)]"
    >
      {children}
    </main>
  );
}
