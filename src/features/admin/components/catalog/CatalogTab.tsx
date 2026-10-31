import type { CatalogKind, CatalogOption } from "../../types/admin-state.types";
import type { Role } from "../../types/admin.types";
import type { FormEventHandler, Dispatch, SetStateAction } from "react";

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
  saveCatalog: FormEventHandler<HTMLFormElement>;
  act: (fn: () => Promise<void>) => Promise<void>;
  api: Api;
  load: () => Promise<void>;
};

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
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
      <h2 className="text-lg font-bold">Sessions and certificate types</h2>
      {role === "superadmin" && (
        <div className="mt-4 flex flex-wrap gap-3">
          <select translate="no" value={catalogKind} onChange={(e) => { setCatalogKind(e.target.value as typeof catalogKind); }} className="rounded border p-2">
            <option value="sessions">Sessions</option>
            <option value="certificateTypes">Certificate types</option>
          </select>
          <form onSubmit={saveCatalog} className="flex gap-2">
            <input translate="no" required value={catalogName} onChange={(e) => { setCatalogName(e.target.value); }} placeholder="New item name" className="rounded border px-3 py-2" />
            <button className="rounded bg-[var(--primary)] px-4 text-[var(--on-primary)]">Add</button>
          </form>
        </div>
      )}
      <ul className="mt-5 divide-y">
        {catalog.map((c) => (
          <li key={c.id} className="flex justify-between py-3">
            {c.label ?? c.name ?? c.id}
            {role === "superadmin" && (
              <button
                onClick={() => {
                  if (confirm("Delete this catalog item?"))
                    act(async () => {
                      await api(`/api/admin/catalog/${catalogKind}?id=${c.id}`, { method: "DELETE" });
                      await load();
                    });
                }}
                className="text-sm text-[var(--danger)]"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
