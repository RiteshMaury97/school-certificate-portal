import * as Sentry from "@sentry/nextjs";
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend(event) {
    delete event.user;
    delete event.extra;
    delete event.contexts;
    delete event.tags;
    delete event.transaction;
    delete event.culprit;
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
      if (event.request.query_string) event.request.query_string = "[redacted]";
      if (event.request.url)
        event.request.url = event.request.url
          .split("?")[0]
          .replace(/(certificates|students|reports)\/[^/]+/g, "$1/[id]");
    }
    if (event.message) event.message = "[redacted application error]";
    if (event.logentry?.message)
      event.logentry.message = "[redacted application error]";
    for (const item of event.exception?.values ?? [])
      if (item.value) item.value = "[redacted]";
    for (const crumb of event.breadcrumbs ?? []) {
      delete crumb.data;
      if (crumb.message) crumb.message = "[redacted]";
    }
    return event;
  },
});
