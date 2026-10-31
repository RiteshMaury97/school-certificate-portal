import { tabs } from "../config/admin-navigation";

import type { Role, Tab } from "../types/admin.types";

export function getVisibleTabs(role: Role): Tab[] {
  return tabs.filter((tab) =>
    role === "superadmin"
      ? true
      : role === "uploader"
        ? ["help", "dashboard", "students", "certificates", "catalog"].includes(tab)
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
          ].includes(tab),
  );
}
