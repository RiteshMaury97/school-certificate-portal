"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileBadge2,
  Plus,
  School,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { confirmAction } from "@/shared/admin-dialogs";

import type { CatalogKind, CatalogOption } from "../../types/admin-state.types";
import type { Role } from "../../types/admin.types";
import type { SubmitEventHandler, Dispatch, SetStateAction } from "react";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;

type CatalogTabProps = {
  role: Role;
  catalogKind: CatalogKind;
  setCatalogKind: Dispatch<SetStateAction<CatalogKind>>;
  catalogName: string;
  setCatalogName: Dispatch<SetStateAction<string>>;
  catalog: CatalogOption[];
  saveCatalog: SubmitEventHandler<HTMLFormElement>;
  act: (fn: () => Promise<void>) => Promise<void>;
  api: Api;
  load: () => Promise<void>;
};

const pageSize = 10;
const sections: {
  kind: CatalogKind;
  label: string;
  singular: string;
  description: string;
  icon: typeof CalendarDays;
  empty: string;
  placeholder: string;
}[] = [
  {
    kind: "sessions",
    label: "Sessions",
    singular: "Session",
    description: "Manage the academic years available across the portal.",
    icon: CalendarDays,
    empty: "No academic sessions have been added.",
    placeholder: "Example: 2026-27",
  },
  {
    kind: "certificateTypes",
    label: "Certificate types",
    singular: "Certificate type",
    description: "Manage the certificate names staff can issue to students.",
    icon: FileBadge2,
    empty: "No certificate types have been added.",
    placeholder: "Example: Transfer Certificate",
  },
  {
    kind: "classes",
    label: "Classes",
    singular: "Class",
    description: "Manage class and section names used in student records.",
    icon: School,
    empty: "No classes have been added.",
    placeholder: "Example: Class 10 A",
  },
];

export default function CatalogTab({
  role,
  catalogKind,
  setCatalogKind,
  catalogName,
  setCatalogName,
  catalog,
  saveCatalog,
  act,
  api,
  load,
}: CatalogTabProps) {
  const [page, setPage] = useState(0);
  const section = sections.find((item) => item.kind === catalogKind) ?? sections.at(0);
  const pageCount = Math.max(1, Math.ceil(catalog.length / pageSize));
  const visiblePage = Math.min(page, pageCount - 1);
  const visibleItems = useMemo(
    () => catalog.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize),
    [catalog, visiblePage],
  );
  const canManage = role === "superadmin" || role === "admin";
  if (!section) return null;
  const Icon = section.icon;

  function changeSection(kind: CatalogKind) {
    setPage(0);
    setCatalogKind(kind);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--divider)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
      <header className="border-b border-[var(--divider)] bg-[var(--surface-2)] px-5 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--primary)] text-[var(--on-primary)]">
            <Icon size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--primary)]">
              School setup
            </p>
            <h1 className="mt-1 text-xl font-bold text-[var(--text)]">Catalog management</h1>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
              Keep academic sessions, certificate types, and classes in their own lists.
            </p>
          </div>
        </div>
        <div
          className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3"
          role="tablist"
          aria-label="Catalog sections"
        >
          {sections.map(({ kind, label, icon: SectionIcon }) => {
            const selected = catalogKind === kind;
            return (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  changeSection(kind);
                }}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${selected ? "border-[var(--primary)] bg-[var(--surface)] text-[var(--primary)] shadow-sm" : "border-[var(--divider)] bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface)]"}`}
              >
                <SectionIcon size={16} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </header>

      <div role="tabpanel" className="p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">{section.label}</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{section.description}</p>
          </div>
          <span className="rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-muted)]">
            {catalog.length} {catalog.length === 1 ? "item" : "items"}
          </span>
        </div>

        {canManage && (
          <form
            onSubmit={saveCatalog}
            className="mt-5 flex flex-col gap-2 rounded-xl border border-[var(--divider)] bg-[var(--surface-2)] p-3 sm:flex-row"
          >
            <label className="sr-only" htmlFor="catalog-item-name">
              {section.label} name
            </label>
            <input
              id="catalog-item-name"
              aria-label={`${section.label} name`}
              translate="no"
              required aria-required="true"
              maxLength={80}
              value={catalogName}
              onChange={(event) => {
                setCatalogName(event.target.value);
              }}
              placeholder={section.placeholder}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--focus)]"
            />
            <button aria-label={`Add ${section.singular}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--on-primary)] transition hover:opacity-90">
              <Plus size={16} aria-hidden="true" />
              Add {section.singular}
            </button>
          </form>
        )}

        <div className="mt-5 overflow-hidden rounded-xl border border-[var(--divider)]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center border-b border-[var(--divider)] bg-[var(--surface-2)] px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            <span>{section.singular} name</span>
            <span>Actions</span>
          </div>
          {visibleItems.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--text-muted)]">
                <Icon size={18} aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[var(--text)]">Nothing here yet</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{section.empty}</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--divider)]">
              {visibleItems.map((item, index) => (
                <li
                  key={item.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-[var(--surface-2)]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--surface-2)] text-[10px] font-semibold text-[var(--text-muted)]">
                      {visiblePage * pageSize + index + 1}
                    </span>
                    <span className="truncate text-sm font-medium text-[var(--text)]">
                      {item.label ?? item.name ?? item.id}
                    </span>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => {
                        void confirmAction(
                          "Delete catalog item",
                          `Delete “${item.label ?? item.name ?? item.id}” from ${section.label.toLowerCase()}?`,
                          "Delete item",
                        ).then((accepted) => {
                          if (accepted)
                            void act(async () => {
                              await api(
                                `/api/admin/catalog/${catalogKind}?id=${encodeURIComponent(item.id)}`,
                                { method: "DELETE" },
                              );
                              await load();
                            });
                        });
                      }}
                      aria-label={`Delete ${item.label ?? item.name ?? item.id}`}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[var(--danger)] hover:bg-[var(--surface)]"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Delete
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--text-muted)]">View only</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <nav
            aria-label={`${section.label} pagination`}
            className="flex items-center justify-between border-t border-[var(--divider)] bg-[var(--surface)] px-4 py-3"
          >
            <span className="text-[11px] text-[var(--text-muted)]">
              Showing {catalog.length ? page * pageSize + 1 : 0}–
              {Math.min((page + 1) * pageSize, catalog.length)} of {catalog.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={visiblePage === 0}
                onClick={() => {
                  setPage(Math.max(0, visiblePage - 1));
                }}
                className="grid h-8 w-8 place-items-center rounded-md border border-[var(--divider)] text-[var(--text)] disabled:opacity-40"
              >
                <ChevronLeft size={15} aria-hidden="true" />
                <span className="sr-only">Previous page</span>
              </button>
              <span className="min-w-16 text-center text-xs text-[var(--text-muted)]">
                {visiblePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={visiblePage + 1 >= pageCount}
                onClick={() => {
                  setPage(visiblePage + 1);
                }}
                className="grid h-8 w-8 place-items-center rounded-md border border-[var(--divider)] text-[var(--text)] disabled:opacity-40"
              >
                <ChevronRight size={15} aria-hidden="true" />
                <span className="sr-only">Next page</span>
              </button>
            </div>
          </nav>
        </div>
      </div>
    </section>
  );
}
