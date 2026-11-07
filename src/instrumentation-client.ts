import * as Sentry from "@sentry/nextjs";

type BeforeSend = NonNullable<NonNullable<Parameters<typeof Sentry.init>[0]>["beforeSend"]>;
type SentryEvent = Parameters<BeforeSend>[0];

function scrubRequest(request: NonNullable<SentryEvent["request"]>) {
  delete request.data;
  delete request.cookies;
  delete request.headers;
  if (request.query_string) request.query_string = "[redacted]";
  if (request.url) {
    request.url = request.url
      .replace(/\?.*$/, "")
      .replace(/(certificates|students|reports)\/[^/]+/g, "$1/[id]");
  }
}

function scrubEventMessage(event: SentryEvent) {
  if (event.message) event.message = "[redacted application error]";
  if (event.logentry?.message) event.logentry.message = "[redacted application error]";
}

function scrubExceptions(event: SentryEvent) {
  for (const item of event.exception?.values ?? []) {
    if (item.value) item.value = "[redacted]";
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
  scrubEventMessage(event);
  scrubExceptions(event);
  scrubBreadcrumbs(event);
  return event;
}

Sentry.init({
  dsn: process.env.BROWSER_SENTRY_DSN,
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
