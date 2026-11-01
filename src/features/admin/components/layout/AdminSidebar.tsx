import { Database, Settings } from "lucide-react";
import Link from "next/link";


import { tabIcons, tabLabels } from "../../config/admin-navigation";
import { getVisibleTabs } from "../../utils/admin-tab-access";

import type { Role, Tab } from "../../types/admin.types";

type AdminSidebarProps = {
  role: Role;
  email: string;
  tab: Tab;
  setTab: (tab: Tab) => void;
  setPage: (page: number) => void;
  onSettings: () => void;
  onSystemHealth: () => void;
  onLoadSessions: () => void;
};

export default function AdminSidebar({
  role,
  email,
  tab,
  setTab,
  setPage,
  onSettings,
  onSystemHealth,
  onLoadSessions,
}: AdminSidebarProps) {
  const username = email.split("@")[0];
  return (
    <aside
      className="sis-admin-sidebar hidden w-[258px] shrink-0 flex-col md:flex"
      aria-label="Admin sidebar"
    >
      <Link href="/admin" className="sis-admin-brand flex items-center gap-3 px-5 py-6">
        <span className="sis-admin-logo" aria-hidden="true">
          S
        </span>
        <span className="min-w-0">
          <strong className="block truncate text-sm">Satyam International</strong>
          <small className="block text-[9px] uppercase tracking-wide">School management</small>
        </span>
      </Link>
      <div className="sis-admin-sidebar-divider mx-5" />
      <p className="sis-admin-nav-label px-6 pt-5">Workspace</p>
      <nav className="sis-admin-sidebar-nav flex-1 px-3 py-2" aria-label="Admin sections">
        {getVisibleTabs(role).map((t) => {
          const Icon = tabIcons[t];
          const label = tabLabels[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setPage(0);
              }}
              aria-current={tab === t ? "page" : undefined}
              className={`sis-admin-nav-item ${tab === t ? "is-active" : ""}`}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
      <div className="sis-admin-sidebar-divider mx-5" />
      <p className="sis-admin-nav-label px-6 pt-4">Administration</p>
      <div className="px-3 pb-4">
        <button type="button" onClick={onSettings} className="sis-admin-nav-item">
          <Settings size={17} />
          <span>Settings</span>
        </button>
        <button type="button" onClick={onSystemHealth} className="sis-admin-nav-item">
          <Database size={17} />
          <span>System Health</span>
        </button>
      </div>
      <div className="sis-admin-user-footer">
        <span className="sis-admin-avatar">
          {(username ? username : "RM").slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-xs">{email || "Administrator"}</strong>
          <small className="block text-[10px] capitalize">{role === "superadmin" ? "Super Administrator" : role}</small>
        </span>
        <button
          type="button"
          onClick={onLoadSessions}
          aria-label="Account sessions"
          className="rounded px-2"
        >
          •••
        </button>
      </div>
    </aside>
  );
}
