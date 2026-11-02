import { useCallback, useEffect, useState, type SubmitEvent } from "react";

import {
  emptyDraft,
  isStatus,
  localDateTime,
  parseIncident,
  toIso,
  type Api,
  type Draft,
  type Filters,
  type Incident,
  type Update,
} from "./breach-types";

type Act = (fn: () => Promise<void>) => Promise<void>;
type Load = () => Promise<void>;
type FullFormEvent = SubmitEvent<HTMLFormElement>;

async function saveFullRecord(
  event: FullFormEvent,
  data: { draft: Draft; selectedId: string; api: Api; act: Act; load: Load; reset: () => void },
): Promise<void> {
  event.preventDefault();
  const { draft, selectedId, api, act, load, reset } = data;
  const discoveredAt = toIso(draft.discoveredAt);
  if (!discoveredAt) return;
  const payload = {
    ...draft,
    occurredAt: toIso(draft.occurredAt),
    discoveredAt,
    boardNotifiedAt: toIso(draft.boardNotifiedAt),
    boardDetailedReportAt: toIso(draft.boardDetailedReportAt),
    principalsNotifiedAt: toIso(draft.principalsNotifiedAt),
    affectedPrincipalsEstimate: Number(draft.affectedPrincipalsEstimate),
  };
  await act(async () => {
    await api("/api/admin/breaches", {
      method: selectedId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selectedId ? { id: selectedId, ...payload } : payload),
    });
    reset();
    await load();
  });
}

function toDraft(incident: Incident): Draft {
  return {
    ...emptyDraft(),
    title: incident.title,
    summary: incident.summary,
    occurredAt: localDateTime(incident.occurredAt),
    discoveredAt: localDateTime(incident.discoveredAt),
    ...toOperationalDraft(incident),
    boardNotifiedAt: localDateTime(incident.boardNotifiedAt),
    boardDetailedReportAt: localDateTime(incident.boardDetailedReportAt),
    principalsNotifiedAt: localDateTime(incident.principalsNotifiedAt),
    rootCause: incident.rootCause ?? "",
    correctiveActions: incident.correctiveActions ?? "",
    lessonsLearned: incident.lessonsLearned ?? "",
    notificationExceptionReason: incident.notificationExceptionReason ?? "",
  };
}

function toOperationalDraft(
  incident: Incident,
): Pick<
  Draft,
  | "howDiscovered"
  | "cause"
  | "dataCategories"
  | "systemsAffected"
  | "affectedPrincipalsEstimate"
  | "involvesMinors"
  | "severity"
  | "containmentActions"
  | "likelyConsequences"
  | "incidentLead"
  | "status"
> {
  return {
    howDiscovered: incident.howDiscovered ?? "",
    cause: incident.cause ?? "other",
    dataCategories: incident.dataCategories ?? [],
    systemsAffected: incident.systemsAffected ?? "",
    affectedPrincipalsEstimate: incident.affectedPrincipalsEstimate?.toString() ?? "0",
    involvesMinors: incident.involvesMinors === true,
    severity: incident.severity || "medium",
    containmentActions: incident.containmentActions ?? "",
    likelyConsequences: incident.likelyConsequences ?? "",
    incidentLead: incident.incidentLead ?? "",
    status: isStatus(incident.status) ? incident.status : "reported",
  };
}

export function useBreachRegister(
  api: Api,
  canManage: boolean,
  initial: Record<string, unknown>[],
) {
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [selectedId, setSelectedId] = useState("");
  const [updates, setUpdates] = useState<Update[]>([]);
  const [filters, setFilters] = useState<Filters>({
    status: "",
    severity: "",
    start: "",
    end: "",
    search: "",
  });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Incident[]>(() =>
    initial.flatMap((record) => {
      const parsed = parseIncident(record);
      return parsed ? [parsed] : [];
    }),
  );
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    if (!canManage) return;
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    for (const [key, value] of Object.entries(filters)) {
      if (value && key !== "search")
        params.set(key, key === "start" || key === "end" ? new Date(value).toISOString() : value);
    }
    if (filters.search) params.set("search", filters.search);
    void api<{ breaches: Incident[]; total: number }>(`/api/admin/breaches?${params}`)
      .then((data) => {
        setItems(data.breaches);
        setTotal(data.total);
      })
      .catch(() => {
        setItems([]);
      });
  }, [api, canManage, filters, initial, page]);

  const loadSelected = useCallback(
    async (id: string) => {
      if (!id || !canManage) return;
      try {
        const { incident, updates: history } = await api<{ incident: Incident; updates: Update[] }>(
          `/api/admin/breaches/${encodeURIComponent(id)}`,
        );
        setDraft(toDraft(incident));
        setItems((current) =>
          current.map((item) =>
            item.id === id && typeof incident.responseTargetHours === "number"
              ? { ...item, responseTargetHours: incident.responseTargetHours }
              : item,
          ),
        );
        setUpdates(history);
      } catch {
        setUpdates([]);
      }
    },
    [api, canManage],
  );
  const refreshSelected = useCallback(() => loadSelected(selectedId), [loadSelected, selectedId]);
  const selectIncident = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (id) void loadSelected(id);
      else setUpdates([]);
    },
    [loadSelected],
  );

  const changeDraft = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);
  const reset = useCallback(() => {
    setSelectedId("");
    setDraft(emptyDraft());
    setUpdates([]);
  }, []);
  const submit = useCallback(
    (event: FullFormEvent, act: Act, load: Load) =>
      saveFullRecord(event, { draft, selectedId, api, act, load, reset }),
    [api, draft, reset, selectedId],
  );

  return {
    draft,
    setDraft: changeDraft,
    selectedId,
    setSelectedId,
    selectIncident,
    updates,
    filters,
    setFilters,
    page,
    setPage,
    items,
    total,
    pageSize,
    reset,
    refreshSelected,
    submit,
  };
}
