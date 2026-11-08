import { useState, type SubmitEvent, type Dispatch, type SetStateAction } from "react";

import { createDefaultAnnouncement, createDefaultFaqs } from "../config/admin-defaults";

import type { AnnouncementState, FaqItem } from "../types/admin-state.types";

type Api = <T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  init?: RequestInit,
) => Promise<T>;

function createSaveAnnouncement(
  api: Api,
  act: (fn: () => Promise<void>) => Promise<void>,
  setToast: Dispatch<SetStateAction<string>>,
  announcement: AnnouncementState,
): (event: SubmitEvent<HTMLFormElement>) => Promise<void> {
  return async (event) => {
    event.preventDefault();
    await act(async () => {
      await api("/api/admin/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...announcement,
          startAt: new Date(announcement.startAt).toISOString(),
          endAt: new Date(announcement.endAt).toISOString(),
        }),
      });
      setToast("Announcement saved.");
    });
  };
}

export function useSiteSettingsAdmin(
  api: Api,
  act: (fn: () => Promise<void>) => Promise<void>,
  setToast: Dispatch<SetStateAction<string>>,
) {
  const [faqs, setFaqs] = useState<FaqItem[]>(createDefaultFaqs());
  const [announcement, setAnnouncement] = useState<AnnouncementState>(createDefaultAnnouncement());
  const saveAnnouncement = createSaveAnnouncement(api, act, setToast, announcement);

  async function saveFaqs() {
    await act(async () => {
      await api("/api/admin/faqs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faqs }),
      });
    });
  }

  return { faqs, setFaqs, announcement, setAnnouncement, saveFaqs, saveAnnouncement };
}
