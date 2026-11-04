import { Bell, Menu, Moon, Monitor, Sun, UserRound, X } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import IncidentSummaryBadge from "./IncidentSummaryBadge";
import { tabLabels } from "../../config/admin-navigation";

import type { Tab } from "../../types/admin.types";
import type { Role } from "../../types/admin.types";
import type { Dispatch, SetStateAction } from "react";
import type { MouseEventHandler } from "react";

type AdminHeaderProps = {
  tab: Tab;
  role: Role;
  email: string;
  profileName: string;
  mobileAdminNav: boolean;
  setMobileAdminNav: Dispatch<SetStateAction<boolean>>;
  themeMode: string;
  toggleTheme: () => void;
  onTickets: () => void;
  onReportIncident: () => void;
  onSessions: () => void;
  revokeAllSessions: () => void;
  logout: () => void;
  onProfile: MouseEventHandler<HTMLButtonElement>;
};

export default function AdminHeader({
  tab,
  role,
  email,
  profileName,
  mobileAdminNav,
  setMobileAdminNav,
  themeMode,
  toggleTheme,
  onTickets,
  onReportIncident,
  onSessions,
  revokeAllSessions,
  logout,
  onProfile,
}: AdminHeaderProps) {
  const username = email.split("@")[0] ?? "";
  const nameToFormat = profileName.trim() || username;
  const displayName = nameToFormat
    ? nameToFormat
        .toLowerCase()
        .replace(
          /(^|[\s'-])([\p{L}])/gu,
          (_match, separator: string, letter: string) => separator + letter.toUpperCase(),
        )
    : "Administrator";
  return (
    <header className="sis-admin-header">
      <div className="mx-auto flex w-full items-center justify-between gap-4 px-6 py-4 lg:px-7">
        <div>
          <Breadcrumb className="mb-1.5">
            <BreadcrumbList className="text-[10px] font-semibold tracking-wide">
              <BreadcrumbItem>
                <BreadcrumbLink href="/admin">Workspace</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/admin">Administration</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{tabLabels[tab]}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <h1 className="text-lg font-semibold leading-tight text-[var(--text)]">
            {tab === "dashboard" ? `Welcome back, ${displayName}` : tabLabels[tab]}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            Here’s what’s happening across your school portal today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IncidentSummaryBadge role={role} />
          <button
            type="button"
            onClick={onReportIncident}
            className="min-h-10 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--on-primary)]"
          >
            Report an incident
          </button>
          <button
            type="button"
            aria-label={mobileAdminNav ? "Close navigation" : "Open navigation"}
            title={mobileAdminNav ? "Close navigation" : "Open navigation"}
            onClick={() => {
              setMobileAdminNav((value) => !value);
            }}
            className="utility-icon md:hidden"
          >
            {mobileAdminNav ? <X size={18} /> : <Menu size={18} />}
          </button>
          <button
            type="button"
            aria-label="Notifications and support tickets"
            title="Notifications"
            onClick={onTickets}
            className="utility-icon"
          >
            <Bell size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Theme: ${themeMode}. Click to change`}
            title={`Theme: ${themeMode}`}
            className="utility-icon"
          >
            {themeMode === "system" ? (
              <Monitor size={18} aria-hidden="true" />
            ) : themeMode === "light" ? (
              <Sun size={18} aria-hidden="true" />
            ) : (
              <Moon size={18} aria-hidden="true" />
            )}
          </button>
          <details className="relative">
            <summary
              aria-label="Administrator profile menu"
              title="Profile menu"
              className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-[color-mix(in_srgb,var(--on-primary)_40%,transparent)] px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <UserRound size={18} aria-hidden="true" />
              <span className="hidden sm:inline">Profile</span>
              <span aria-hidden="true">▾</span>
            </summary>
            <div className="absolute right-0 z-50 mt-2 min-w-56 rounded-xl border border-[var(--divider)] bg-[var(--surface)] p-2 text-[var(--text)] shadow-xl">
              <button
                type="button"
                onClick={onProfile}
                className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"
              >
                My profile
              </button>
              <button
                onClick={onSessions}
                className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"
              >
                Sessions &amp; sign-ins
              </button>
              <button
                onClick={() => {
                  revokeAllSessions();
                }}
                className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-[var(--surface-2)]"
              >
                Sign out of all devices
              </button>
              <button
                onClick={logout}
                className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]"
              >
                Sign out
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
