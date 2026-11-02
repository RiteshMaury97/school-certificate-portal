"use client";

import { ShieldAlert } from "lucide-react";

import BreachIncidentDetail from "./BreachIncidentDetail";
import BreachRegisterList from "./BreachRegisterList";
import { useBreachRegister } from "./useBreachRegister";

import type { Api } from "./breach-types";
import type { Role } from "../../types/admin.types";
import type { SubmitEvent } from "react";

type Props = {
  role: Role;
  breaches: Record<string, unknown>[];
  loaded: boolean;
  act: (fn: () => Promise<void>) => Promise<void>;
  api: Api;
  load: () => Promise<void>;
};

export default function BreachesTab({ role, breaches, loaded, act, api, load }: Props) {
  const canManage = role === "superadmin";
  const register = useBreachRegister(api, canManage, breaches);
  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    void register.submit(event, act, load);
  }
  function cancelEditing() {
    register.reset();
  }
  const selected = register.items.find((incident) => incident.id === register.selectedId);
  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">
            <ShieldAlert size={15} />
            Compliance / Incident response
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">
            Personal data breach register
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
            Capture suspected incidents promptly, track containment and notifications, and maintain
            an append-only decision history. Never include personal details of affected people.
          </p>
          <a
            className="mt-3 inline-block text-sm underline"
            href="/api/admin/breaches/response-plan"
            target="_blank"
            rel="noreferrer"
          >
            Open breach response plan
          </a>
        </div>
      </header>
      {canManage && (
        <section
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
          aria-labelledby="first-24-title"
        >
          <h3 id="first-24-title" className="font-semibold">
            First 24 hours
          </h3>
          <ul className="mt-3 grid gap-2 text-sm text-[var(--text-muted)] sm:grid-cols-2">
            <li>Confirm containment and check for continuing access.</li>
            <li>Preserve relevant logs and assess the scope and data categories.</li>
            <li>Rotate exposed keys and revoke administrator sessions if needed.</li>
            <li>
              Assign response roles, prepare adviser-reviewed drafts and record notification
              decisions.
            </li>
          </ul>
        </section>
      )}
      {canManage && (
        <BreachRegisterList
          items={register.items}
          total={register.total}
          loaded={loaded}
          isSuperadmin={canManage}
          page={register.page}
          pageSize={register.pageSize}
          filters={register.filters}
          selectedId={register.selectedId}
          setPage={register.setPage}
          setFilters={register.setFilters}
          select={(id) => {
            register.selectIncident(register.selectedId === id ? "" : id);
          }}
        />
      )}
      {canManage && selected && (
        <BreachIncidentDetail
          incident={selected}
          updates={register.updates}
          draft={register.draft}
          setDraft={register.setDraft}
          submit={handleSubmit}
          cancel={cancelEditing}
          api={api}
          act={act}
          load={load}
          refresh={register.refreshSelected}
        />
      )}
      {!canManage && (
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
          Your report is visible to the superadmin response team. Incident register details are
          restricted.
        </p>
      )}
    </section>
  );
}
