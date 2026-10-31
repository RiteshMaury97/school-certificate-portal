import type { Dispatch, SetStateAction } from "react";

type TimelineTabProps = {
  timelineStudentId: string;
  setTimelineStudentId: Dispatch<SetStateAction<string>>;
  timeline: Record<string, unknown>[];
};

export default function TimelineTab({
  timelineStudentId,
  setTimelineStudentId,
  timeline,
}: TimelineTabProps) {
  return (
    <section className="rounded-xl border bg-[var(--surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {timelineStudentId ? "Student activity timeline" : "Global activity timeline"}
        </h2>
        <button onClick={() => { setTimelineStudentId(""); }} className="rounded border px-3 py-1 text-xs">
          Show global
        </button>
      </div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Recent uploads, approvals, rejections, edits, revocations and public verification activity.
      </p>
      <ol className="mt-4 space-y-3">
        {timeline.map((e) => (
          <li key={String(e.id)} className="flex gap-3 border-l-2 border-[var(--divider)] pl-4">
            <div>
              <p className="font-semibold">{String(e.action ?? "Activity")}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {String(e.actor ?? "System")} · {String(e.timestamp ?? "Time unavailable")} · {String(e.targetId ?? "")}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
