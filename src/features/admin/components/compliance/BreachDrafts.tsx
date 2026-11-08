"use client";

import { useEffect, useId, useMemo, useState } from "react";

import { generateBreachDraft } from "@/shared/breach-drafts";

import type { Incident } from "./breach-types";
import type { DraftContact } from "@/shared/breach-drafts";

type Contact = Required<DraftContact>;
type Audience = "board" | "people";
type EditedDraft = { key: string; value: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAudience(value: string): value is Audience {
  return value === "board" || value === "people";
}

function DraftEditor({
  recipientId,
  draftId,
  audience,
  draft,
  copied,
  onAudienceChange,
  onDraftChange,
  onCopy,
}: {
  recipientId: string;
  draftId: string;
  audience: Audience;
  draft: string;
  copied: boolean;
  onAudienceChange: (value: Audience) => void;
  onDraftChange: (value: string) => void;
  onCopy: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <label htmlFor={recipientId} className="text-sm">
          Recipient *
        </label>
        <select
          id={recipientId}
          required
          aria-required="true"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2"
          value={audience}
          onChange={(event) => {
            if (isAudience(event.target.value)) onAudienceChange(event.target.value);
          }}
        >
          <option value="board">Data Protection Board</option>
          <option value="people">Affected people</option>
        </select>
      </div>
      <label className="block text-sm font-medium" htmlFor={draftId}>
        Draft text *
      </label>
      <textarea
        id={draftId}
        aria-label="Draft notification text"
        required
        aria-required="true"
        minLength={10}
        maxLength={10000}
        className="min-h-64 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm"
        value={draft}
        onChange={(event) => {
          onDraftChange(event.target.value);
        }}
      />
      <button
        type="button"
        aria-label="Copy notification draft"
        className="min-h-10 rounded-lg border border-[var(--border)] px-4 text-sm"
        onClick={onCopy}
      >
        {copied ? "Copied" : "Copy draft"}
      </button>
    </>
  );
}

export default function BreachDrafts({ incident }: { incident: Incident }) {
  const recipientId = useId();
  const draftId = useId();
  const [audience, setAudience] = useState<Audience>("board");
  const [contact, setContact] = useState<Contact>({ name: "", email: "", phone: "" });
  const [editedDraft, setEditedDraft] = useState<EditedDraft | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/public/site-settings", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result: unknown = await response.json();
        if (!isRecord(result) || !isRecord(result.settings)) return;
        const settings = result.settings;
        if (active) {
          setContact({
            name:
              typeof settings.grievanceOfficerName === "string"
                ? settings.grievanceOfficerName
                : "",
            email:
              typeof settings.grievanceOfficerEmail === "string"
                ? settings.grievanceOfficerEmail
                : "",
            phone:
              typeof settings.grievanceOfficerPhone === "string"
                ? settings.grievanceOfficerPhone
                : "",
          });
        }
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  const draftKey = [
    incident.id,
    audience,
    incident.summary,
    incident.discoveredAt,
    contact.email,
  ].join("|");
  const generated = useMemo(
    () => generateBreachDraft(incident, audience, contact),
    [incident, audience, contact],
  );
  const draft = editedDraft?.key === draftKey ? editedDraft.value : generated;

  async function copyDraft() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1800);
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-[var(--border)] p-4"
      aria-labelledby="breach-drafts-title"
    >
      <div>
        <h4 id="breach-drafts-title" className="font-semibold">
          Notification drafts
        </h4>
        <p className="text-sm text-[var(--text-muted)]">
          Editable text only. Nothing is sent from this screen.
        </p>
        <p className="mt-1 text-sm font-medium">
          Have the school advisor review the wording before use.
        </p>
      </div>
      <DraftEditor
        recipientId={recipientId}
        draftId={draftId}
        audience={audience}
        draft={draft}
        copied={copied}
        onAudienceChange={setAudience}
        onDraftChange={(value) => {
          setEditedDraft({ key: draftKey, value });
        }}
        onCopy={() => {
          void copyDraft();
        }}
      />
    </section>
  );
}
