import { AlertTriangle, Clock3 } from "lucide-react";

import { calculateBreachDeadlines } from "@/shared/breach-deadlines";

import { formatIst, type Api, type Incident, type Update } from "./breach-types";
import BreachDrafts from "./BreachDrafts";
import BreachEditor from "./BreachEditor";
import { warning } from "./BreachFields";
import BreachNotificationActions from "./BreachNotificationActions";
import BreachTimeline from "./BreachTimeline";
import BreachUpdateForm from "./BreachUpdateForm";

type Props = {
  incident: Incident;
  updates: Update[];
  draft: Parameters<typeof BreachEditor>[0]["draft"];
  setDraft: Parameters<typeof BreachEditor>[0]["setDraft"];
  submit: Parameters<typeof BreachEditor>[0]["submit"];
  cancel: () => void;
  api: Api;
  act: (fn: () => Promise<void>) => Promise<void>;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
};

export default function BreachIncidentDetail(props: Props) {
  return (
    <section
      className="space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6"
      aria-labelledby="breach-detail-heading"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
            Incident detail · {props.incident.id}
          </p>
          <h3 id="breach-detail-heading" className="mt-1 text-xl font-semibold">
            {props.incident.title}
          </h3>
          <p className={warning}>Discovered {formatIst(props.incident.discoveredAt)} IST</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              window.print();
            }}
            className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-sm"
          >
            Print incident
          </button>
          <button
            type="button"
            onClick={() => void downloadIncident(props.incident.id, "pdf")}
            className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-sm"
          >
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => void downloadIncident(props.incident.id, "csv")}
            className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-sm"
          >
            Export CSV
          </button>
        </div>
      </header>
      <Deadline incident={props.incident} />
      <BreachNotificationActions
        incident={props.incident}
        api={props.api}
        act={props.act}
        load={props.load}
        refresh={props.refresh}
      />
      <BreachUpdateForm
        incident={props.incident}
        api={props.api}
        act={props.act}
        load={props.load}
        refresh={props.refresh}
      />
      <BreachTimeline updates={props.updates} />
      <BreachDrafts incident={props.incident} />
      <section>
        <h4 className="mb-3 font-semibold">Edit incident and close</h4>
        <p className={warning}>
          Closing requires root cause, corrective actions, lessons learned, and required
          notification records or a written exception reason.
        </p>
        <BreachEditor
          draft={props.draft}
          selectedId={props.incident.id}
          setDraft={props.setDraft}
          submit={props.submit}
          cancel={props.cancel}
        />
      </section>
    </section>
  );
}

function Deadline({ incident }: { incident: Incident }) {
  const deadlines = calculateBreachDeadlines(incident.discoveredAt, new Date(), {
    "board-initial":
      incident.boardNotifiedAt ??
      (incident.boardNotificationNotRequiredReason
        ? `Not required: ${incident.boardNotificationNotRequiredReason}`
        : null),
    "affected-people":
      incident.principalsNotifiedAt ??
      (incident.affectedPeopleNotificationNotRequiredReason
        ? `Not required: ${incident.affectedPeopleNotificationNotRequiredReason}`
        : null),
    "board-detailed":
      incident.boardDetailedReportAt ??
      (incident.boardDetailedReportNotRequiredReason
        ? `Not required: ${incident.boardDetailedReportNotRequiredReason}`
        : null),
  });
  return (
    <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <h4 className="font-semibold">Rule 7 deadline tracker</h4>
      <p className={warning}>
        Initial Board and affected-person intimations are due without delay. The detailed Board
        report is due within 72 hours of discovery.
      </p>
      {!deadlines.length && (
        <p className={warning}>Discovery date is required to calculate deadlines.</p>
      )}
      <div className="grid gap-2 md:grid-cols-3">
        {deadlines.map((item) => {
          const hours = Math.floor(Math.abs(item.remainingMs) / 3_600_000);
          const state = item.completedAt?.startsWith("Not required:")
            ? item.completedAt
            : item.completedAt
              ? `Recorded ${formatIst(item.completedAt)} IST`
              : item.step !== "board-detailed"
                ? "Due without delay · not recorded"
                : item.overdue
                  ? `Overdue · ${String(hours)} hours`
                  : `${String(Math.floor(item.remainingMs / 3_600_000))} hours remaining`;
          return (
            <div
              key={item.step}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <p className="flex items-center gap-2 text-sm font-medium">
                {item.overdue ? (
                  <AlertTriangle size={15} aria-hidden="true" />
                ) : (
                  <Clock3 size={15} aria-hidden="true" />
                )}
                {item.label}
              </p>
              <p className="mt-1 text-sm">{state}</p>
              <p className={warning}>Deadline: {formatIst(item.dueAt.toISOString())} IST</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

async function downloadIncident(id: string, format: "pdf" | "csv") {
  const response = await fetch(
    `/api/admin/breaches/export?id=${encodeURIComponent(id)}&format=${format}`,
  );
  if (!response.ok) throw new Error("Unable to export this incident.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `incident-${id}.${format}`;
  link.click();
  URL.revokeObjectURL(url);
}
