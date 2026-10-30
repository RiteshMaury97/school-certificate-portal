"use client";
import { NavLink } from "react-router-dom";
const links = [
  ["Dashboard", "/admin"],
  ["Students", "/admin/students"],
  ["Certificates", "/admin/certificates"],
  ["Approvals", "/admin/approvals"],
  ["Sessions", "/admin/sessions"],
  ["Tickets", "/admin/tickets"],
  ["Audit log", "/admin/audit"],
  ["Settings", "/admin/settings"],
  ["Admins", "/admin/admins"],
  ["Backup", "/admin/backup"],
];
export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
      <nav className="space-y-1">
        {links.map(([label, to]) => (
          <NavLink
            end={to === "/admin"}
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex min-h-11 items-center rounded-lg px-3 text-sm font-medium ${isActive ? "bg-blue-50 text-blue-900" : "text-slate-600 hover:bg-slate-50"}`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
