import { Bell, Menu, Moon, Monitor, Sun, UserRound, X } from "lucide-react";

import type { Tab } from "../../types/admin.types";
import type { Dispatch, SetStateAction } from "react";

type AdminHeaderProps = {
  tab: Tab;
  email: string;
  mobileAdminNav: boolean;
  setMobileAdminNav: Dispatch<SetStateAction<boolean>>;
  themeMode: string;
  toggleTheme: () => void;
  onTickets: () => void;
  loadSessions: () => void;
  revokeAllSessions: () => void;
  logout: () => void;
};

export default function AdminHeader({
  tab,
  email,
  mobileAdminNav,
  setMobileAdminNav,
  themeMode,
  toggleTheme,
  onTickets,
  loadSessions,
  revokeAllSessions,
  logout,
}: AdminHeaderProps) {
  return (
    <header className="sis-admin-header">
      <div className="mx-auto flex w-full items-center justify-between gap-4 px-6 py-4 lg:px-7">
        <div>
          <p className="sis-admin-breadcrumb">Workspace <span>/</span> Administration <span>/</span> {tab === "dashboard" ? "Overview" : tab === "help" ? "Help & Policies" : tab.charAt(0).toUpperCase() + tab.slice(1)}</p>
          <h1 className="text-lg font-semibold leading-tight text-[var(--text)]">
            {tab === "dashboard" ? `Welcome back, ${email.split("@")[0] || "Administrator"}` : tab === "help" ? "Help & Policies" : tab === "catalog" ? "Sessions & Types" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">Here’s what’s happening across your school portal today.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label={mobileAdminNav ? "Close navigation" : "Open navigation"} title={mobileAdminNav ? "Close navigation" : "Open navigation"} onClick={() => { setMobileAdminNav((value) => !value); }} className="utility-icon md:hidden">
            {mobileAdminNav ? <X size={18} /> : <Menu size={18} />}
          </button>
          <button type="button" aria-label="Notifications and support tickets" title="Notifications" onClick={onTickets} className="utility-icon">
            <Bell size={18} aria-hidden="true" />
          </button>
          <button type="button" onClick={toggleTheme} aria-label={`Theme: ${themeMode}. Click to change`} title={`Theme: ${themeMode}`} className="utility-icon">
            {themeMode === "system" ? <Monitor size={18} aria-hidden="true" /> : themeMode === "light" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          <details className="relative">
            <summary aria-label="Administrator profile menu" title="Profile menu" className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--on-primary)_40%,transparent)] px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
              <UserRound size={18} aria-hidden="true" />
              <span className="hidden sm:inline">Profile</span>
              <span aria-hidden="true">▾</span>
            </summary>
            <div className="absolute right-0 z-50 mt-2 min-w-56 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-2 text-[var(--text)] shadow-xl">
              <button onClick={() => { loadSessions(); }} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]">Active sessions / recent logins</button>
              <button onClick={() => { revokeAllSessions(); }} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--surface-2)]">Sign out of all devices</button>
              <button onClick={logout} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]">Sign out</button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
