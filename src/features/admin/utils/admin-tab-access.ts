import { tabs } from "../config/admin-navigation";

import type { Role, Tab } from "../types/admin.types";

export function getVisibleTabs(role: Role): Tab[] {
  return tabs.filter((tab) =>
    role === "superadmin"
      ? true
      : role === "uploader"
        ? ["dashboard", "students", "studentImport", "studentAdd", "certificates", "catalog", "profile", "sessions"].includes(tab)
        : role === "admin"
          ? ["dashboard", "approvals", "students", "studentImport", "studentAdd", "certificates", "catalog", "audit", "rights", "reports", "timeline", "announcement", "contacts", "profile", "sessions"].includes(tab)
          : [
            "dashboard",
            "approvals",
            "students",
            "studentImport",
            "studentAdd",
            "certificates",
            "audit",
            "rights",
            "reports",
            "timeline",
            "announcement",
            "contacts",
            "profile",
            "sessions",
          ].includes(tab),
  );
}
