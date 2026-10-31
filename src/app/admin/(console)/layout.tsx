import AdminConsole from "@/features/admin/AdminConsole";
import AdminGate from "@/features/auth/AdminGate";
import { AdminSessionProvider } from "@/features/auth/admin-session";

/**
 * One shared console for every admin section. It stays mounted while the
 * administrator moves between sections; the section is read from the URL.
 * Individual page.tsx files only supply the page title.
 */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminSessionProvider>
      <AdminGate>
        <AdminConsole />
        {children}
      </AdminGate>
    </AdminSessionProvider>
  );
}
