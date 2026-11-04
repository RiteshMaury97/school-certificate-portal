import * as Sentry from "@sentry/nextjs";

import { assertServerEnvironment } from "@/server/env";

type BeforeSend = NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>["beforeSend"]>;
type SentryEvent = Parameters<BeforeSend>[0];

function scrubRequest(request: NonNullable<SentryEvent["request"]>) {
  delete request.data;
  delete request.cookies;
  delete request.headers;
  if (request.url) {
    request.url = request.url
      .replace(/\?.*$/, "")
      .replace(/(certificates|students|reports)\/[^/]+/g, "$1/[id]");
  }
  if (request.query_string) request.query_string = "[redacted]";
}

function scrubMessages(event: SentryEvent) {
  if (event.message) event.message = "[redacted application error]";
  if (event.logentry?.message) event.logentry.message = "[redacted application error]";
}

function scrubExceptions(event: SentryEvent) {
  for (const exception of event.exception?.values ?? []) {
    if (exception.value) exception.value = "[redacted]";
  }
}

function scrubBreadcrumbs(event: SentryEvent) {
  for (const crumb of event.breadcrumbs ?? []) {
    delete crumb.data;
    if (crumb.message) crumb.message = "[redacted]";
  }
}

function scrub(event: SentryEvent) {
  delete event.user;
  delete event.extra;
  delete event.contexts;
  delete event.tags;
  delete event.transaction;
  if (event.request) scrubRequest(event.request);
  scrubMessages(event);
  scrubExceptions(event);
  scrubBreadcrumbs(event);
  return event;
}

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" && process.env.NEXT_RUNTIME !== "edge") return;
  if (process.env.NEXT_RUNTIME === "nodejs") assertServerEnvironment();
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeSend: scrub,
  });
}

export const onRequestError = Sentry.captureRequestError;
