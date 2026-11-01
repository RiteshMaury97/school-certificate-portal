import { tabs } from "../config/admin-navigation";

import type { Role, Tab } from "../types/admin.types";

export function getVisibleTabs(role: Role): Tab[] {
  return tabs.filter((tab) =>
    role === "superadmin"
      ? true
      : role === "uploader"
        ? ["help", "dashboard", "students", "certificates", "catalog", "profile"].includes(tab)
        : role === "admin"
          ? ["help", "dashboard", "approvals", "students", "certificates", "catalog", "audit", "rights", "reports", "timeline", "announcement", "contacts", "profile"].includes(tab)
          : [
            "help",
            "dashboard",
            "approvals",
            "students",
            "certificates",
            "audit",
            "rights",
            "reports",
            "timeline",
            "announcement",
            "contacts",
            "profile",
          ].includes(tab),
  );
}
