import { X } from "lucide-react";

import { tabIcons, tabLabels } from "../../config/admin-navigation";
import { getVisibleTabs } from "../../utils/admin-tab-access";

import type { Role, Tab } from "../../types/admin.types";
import type { Dispatch, SetStateAction } from "react";

type AdminMobileNavProps = {
  role: Role;
  tab: Tab;
  setTab: (tab: Tab) => void;
  setPage: (page: number) => void;
  mobileAdminNav: boolean;
  setMobileAdminNav: Dispatch<SetStateAction<boolean>>;
};

export default function AdminMobileNav({
  role,
  tab,
  setTab,
  setPage,
  mobileAdminNav,
  setMobileAdminNav,
}: AdminMobileNavProps) {
  return (
    <>
      <nav className="hidden" aria-label="Admin sections">
        {getVisibleTabs(role).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setPage(0);
            }}
            className={`flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ${tab === t ? "bg-[var(--primary)] text-[var(--on-primary)]" : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text)]"}`}
            aria-label={tabLabels[t]}
            title={tabLabels[t]}
          >
            {(() => {
              const Icon = tabIcons[t];
              return <Icon aria-hidden="true" size={17} className="shrink-0" />;
            })()}
            <span className="hidden text-sm lg:inline">{tabLabels[t]}</span>
          </button>
        ))}
      </nav>
      {mobileAdminNav && (
        <div
          className="fixed inset-0 z-[95] bg-[var(--scrim)] md:hidden"
          role="presentation"
          onClick={() => { setMobileAdminNav(false); }}
        >
          <nav
            aria-label="Mobile admin navigation"
            className="h-dvh w-[min(86vw,22rem)] overflow-y-auto border-r border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--text)] shadow-xl"
            onClick={(event) => { event.stopPropagation(); }}
          >
            <div className="mb-4 flex items-center justify-between">
              <strong>Admin navigation</strong>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={() => { setMobileAdminNav(false); }}
                className="utility-icon"
              >
                <X size={18} />
              </button>
            </div>
            {getVisibleTabs(role).map((item) => {
              const Icon = tabIcons[item];
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setTab(item);
                    setPage(0);
                    setMobileAdminNav(false);
                  }}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold capitalize ${tab === item ? "bg-[var(--primary)] text-[var(--on-primary)]" : "text-[var(--text)] hover:bg-[var(--surface-2)]"}`}
                >
                  <Icon size={18} />
                  {tabLabels[item]}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
